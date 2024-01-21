import { db } from "@/app/db";
import { sql, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/app/auth";
import { nanoid } from "nanoid";
import { TimeAgo } from "@/components/time-ago";

type CommentFromDB = {
  id: string;
  story_id: string;
  ancestor_id: string;
  username: null;
  comment: string;
  parent_id: string | null;
  author: null;
  created_at: Date;
  updated_at: Date;
  depth: number;
};

interface CommentWithChildren extends CommentFromDB {
  children: CommentWithChildren[];
}

async function fetchReplies({
  commentId,
  maxReplyDepth,
  limit,
}: {
  commentId: string;
  maxReplyDepth: number;
  limit: number;
}) {
  return await db.execute<CommentFromDB>(sql`
    SELECT 
      comments.*,
      comments_closure_direct.depth,
      comments_closure_direct.ancestor_id,
      comments_closure_direct.descendant_id
    FROM 
      comments
    JOIN 
      comments_closure ON comments.id = comments_closure.descendant_id
    JOIN 
      comments_closure AS comments_closure_direct ON comments.id = comments_closure_direct.descendant_id AND comments_closure_direct.depth = 1
    WHERE 
      comments_closure.ancestor_id = ${commentId} AND comments_closure.depth <= ${maxReplyDepth} AND comments_closure.depth > 0
    ORDER BY 
      comments_closure.depth, comments.created_at
    LIMIT ${limit};
  `);
}

async function getComments({
  storyId,
  author,
  page = 0,
  pageSize = 50,
}: {
  storyId?: string;
  author?: string;
  page?: number;
  pageSize?: number;
}) {
  const sId = storyId ?? "";
  const aId = author ?? "";

  const offset = page * pageSize;
  const totalCommentsLimit = pageSize;
  const replyLimit = 20; // TODO
  const maxReplyDepth = 20; // TODO

  // Fetch the top-level comments for the story
  const comments = (
    await db.execute<CommentFromDB>(sql`
    WITH RECURSIVE dfs_comments AS (
      SELECT 
        comments.*,
        comments_closure.depth,
        comments_closure.ancestor_id,
        comments_closure.descendant_id,
        ARRAY[comments.created_at] AS path,
        1 AS level
      FROM 
        comments
      JOIN 
        comments_closure ON comments.id = comments_closure.descendant_id
      WHERE 
        comments.story_id = ${storyId} AND parent_id IS NULL
    
      UNION ALL
    
      SELECT 
        comments.*,
        comments_closure.depth,
        comments_closure.ancestor_id,
        comments_closure.descendant_id,
        path || comments.created_at,
        level + 1
      FROM 
        comments
      JOIN 
        comments_closure ON comments.id = comments_closure.descendant_id
      JOIN 
        dfs_comments ON comments_closure.ancestor_id = dfs_comments.id
      WHERE 
        level < ${maxReplyDepth} AND comments_closure.depth = 1
    )
    SELECT * FROM dfs_comments
    ORDER BY path
    OFFSET ${offset}
    LIMIT ${totalCommentsLimit};
    `)
  ).rows;

  const parents = comments.filter((comment) => comment.parent_id === null);
  console.debug("parents", parents);

  const children = comments.filter((comment) => comment.parent_id !== null);

  console.debug("children", children);

  console.debug("count", comments.length);

  // Create a map of comments by their ID
  const commentsMap = new Map<string, CommentWithChildren>();
  comments.forEach((comment) => {
    commentsMap.set(comment.id, { ...comment, children: [] });
  });

  // Assign each comment to its parent's `children` array
  comments.forEach((comment) => {
    if (comment.depth !== 0) {
      const parent = commentsMap.get(comment.ancestor_id);
      if (parent) {
        parent.children?.push(commentsMap.get(comment.id)!);
      }
    }
  });

  // Get the top-level comments (i.e., the parent comments for the current page)
  return comments
    .filter((comment) => comment.parent_id === null)
    .map((comment) => commentsMap.get(comment.id)!);
}

export async function Comments({
  storyId,
  author,
}: {
  storyId?: string;
  author?: string;
}) {
  const session = await auth();
  const rid = headers().get("x-vercel-id") ?? nanoid();

  console.time(`fetch comments ${storyId} (req: ${rid})`);
  const commentsWithChildren = await getComments({
    storyId,
    author,
  });
  console.timeEnd(`fetch comments ${storyId} (req: ${rid})`);

  return commentsWithChildren.length === 0 ? (
    <div>No comments to show</div>
  ) : (
    <CommentList
      author={author}
      loggedInUserId={session?.user?.id}
      comments={commentsWithChildren}
    />
  );
}

export function CommentList({
  author,
  loggedInUserId,
  comments,
}: {
  author?: string;
  loggedInUserId?: string;
  comments: CommentWithChildren[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {comments.map((comment, i) => (
        <CommentItem
          key={comment.id}
          i={i}
          loggedInUserId={loggedInUserId}
          author={author}
          comment={comment}
        />
      ))}
    </ul>
  );
}

function CommentItem({
  i,
  author,
  loggedInUserId,
  comment,
}: {
  i: number;
  author?: string;
  loggedInUserId?: string;
  comment: CommentWithChildren;
}) {
  const now = Date.now();
  return (
    <li>
      <div className="flex items-start">
        <div className="flex flex-col items-center mr-1 gap-y-1">
          {loggedInUserId === comment.author ? (
            <span className="text-2xl text-[#FF9966] cursor-pointer">*</span>
          ) : (
            <>
              <svg
                height="12"
                viewBox="0 0 32 16"
                width="12"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="m2 27 14-29 14 29z" fill="#999" />
              </svg>
              <svg
                className="transform rotate-180"
                height="12"
                viewBox="0 0 32 16"
                width="12"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="m2 27 14-29 14 29z" fill="#999" />
              </svg>
            </>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-sm text-gray-600">
              {comment.username}{" "}
              <TimeAgo date={new Date(comment.created_at)} now={now} />{" "}
              <span aria-hidden={true}>|</span>{" "}
              {i > 0 && (
                <>
                  <span title="Unimplemented">prev</span>{" "}
                  <span aria-hidden={true}>| </span>{" "}
                </>
              )}
              <span title="Unimplemented">next</span>
            </p>
            <p className="mb-1">
              {comment.id} {comment.comment}
            </p>
          </div>
          {comment.children && (
            <CommentList
              loggedInUserId={loggedInUserId}
              author={author}
              comments={comment.children}
            />
          )}
        </div>
      </div>
    </li>
  );
}
