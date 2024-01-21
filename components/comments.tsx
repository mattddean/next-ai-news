import { db } from "@/app/db";
import { sql, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/app/auth";
import { nanoid } from "nanoid";
import { TimeAgo } from "@/components/time-ago";
import type { RowList } from "postgres";

type CommentFromDB = {
  id: string;
  story_id: string;
  ancestor_id: string;
  username: null;
  comment: string;
  author: null;
  created_at: Date;
  updated_at: Date;
  depth: number;
};

interface CommentWithChildren extends CommentFromDB {
  children: CommentWithChildren[];
}

async function getComments({
  storyId,
  author,
  page = 1,
  pageSize = 1,
}: {
  storyId?: string;
  author?: string;
  page?: number;
  pageSize?: number;
}) {
  const sId = storyId ?? "";
  const aId = author ?? "";

  const offset = page * pageSize;
  const topLevelLimit = pageSize;
  const replyLimit = 20; // TODO
  const maxReplyDepth = 20; // TODO

  // Fetch the top-level comments for the story
  const topLevelComments = await db.execute<CommentFromDB>(sql`
    SELECT 
      comments.*,
      comments_closure.depth,
      comments_closure.ancestor_id,
      comments_closure.descendant_id
    FROM 
      comments
    JOIN 
      comments_closure ON comments.id = comments_closure.descendant_id
    WHERE 
      comments.story_id = ${storyId} AND NOT EXISTS (
        SELECT 1 FROM comments_closure cc2
        WHERE cc2.descendant_id = comments.id AND cc2.depth > 0
      )    
    ORDER BY 
      comments.created_at
    LIMIT ${topLevelLimit} OFFSET ${offset};
  `);

  // For each top-level comment, fetch a certain number of replies
  const comments = [];
  for (const comment of topLevelComments.rows) {
    const replies = await db.execute<CommentFromDB>(sql`
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
      comments_closure.ancestor_id = ${comment.id} AND comments_closure.depth <= ${maxReplyDepth} AND comments_closure.depth > 0
    ORDER BY 
      comments_closure.depth, comments.created_at;
    `);
    comments.push(comment, ...replies.rows);
  }

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
    .filter((comment) => comment.depth === 0)
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
            <p className="mb-1">{comment.comment}</p>
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
