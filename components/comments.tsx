import { db } from "@/app/db";
import { sql, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/app/auth";
import { nanoid } from "nanoid";
import { TimeAgo } from "@/components/time-ago";
import type { RowList } from "postgres";

type CommentFromDB = {
  id: string;
  comment: string;
  username: string;
  author: string;
  created_at: string;
  parent_id: string | null;
  ancestors: number[];
  rn: number;
};

interface CommentWithChildren extends CommentFromDB {
  children?: CommentWithChildren[];
}

async function getComments({
  storyId,
  author,
  page = 0,
  pageSize = 10,
}: {
  storyId?: string;
  author?: string;
  page?: number;
  pageSize?: number;
}) {
  const sId = storyId ?? "";
  const aId = author ?? "";

  const commentsFromDB = (await db.execute(sql`
    WITH RECURSIVE comment_tree AS (
      SELECT 
        comments.id,
        comments.comment,
        COALESCE(comments.username, users.username) AS username,
        comments.author,
        comments.created_at,
        comments.parent_id,
        ARRAY[]::VARCHAR[] AS ancestors,
        ROW_NUMBER() OVER(PARTITION BY COALESCE(comments.parent_id, comments.id)) AS rn
      FROM 
        comments
      LEFT JOIN 
        users ON users.id = comments.author
      WHERE 
        comments.parent_id IS NULL
        AND (${sId} = '' OR comments.story_id = $1)
        AND (${aId} = '' OR comments.author = $2)
      UNION ALL
      SELECT 
        comments.id,
        comments.comment,
        COALESCE(comments.username, users.username) AS username,
        comments.author,
        comments.created_at,
        comments.parent_id,
        comment_tree.ancestors || comments.parent_id,
        ROW_NUMBER() OVER(PARTITION BY COALESCE(comments.parent_id, comments.id)) AS rn
      FROM 
        comments
      JOIN 
        comment_tree ON comments.parent_id = comment_tree.id
      LEFT JOIN 
        users ON users.id = comments.author
    )
    SELECT * FROM comment_tree
  `)) as unknown as { rows: CommentFromDB[] };

  console.debug("commentsFromDB", commentsFromDB);

  // Create a map of comments by their ID
  const commentsMap = new Map<string, CommentWithChildren>();
  commentsFromDB.rows.forEach((comment) => {
    commentsMap.set(comment.id, { ...comment });
  });

  // Assign each comment to its parent's `children` array
  commentsFromDB.rows.forEach((comment) => {
    if (comment.parent_id !== null) {
      let parent = commentsMap.get(comment.parent_id);
      while (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(commentsMap.get(comment.id)!);
        if (parent.parent_id !== null) {
          parent = commentsMap.get(parent.parent_id);
        } else {
          break;
        }
      }
    }
  });

  // since we've stored all nested comments within the top-level
  // comments as children, just return the top-level comments with
  // their nested children
  const topLevelComments = Array.from(commentsMap.values()).filter(
    (comment) => comment.parent_id === null
  );

  return topLevelComments;
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
