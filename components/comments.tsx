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
  page = 1,
  pageSize = 3,
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
        ROW_NUMBER() OVER(PARTITION BY COALESCE(comments.parent_id, comments.id)) AS rn,
        ROW_NUMBER() OVER(ORDER BY comments.created_at DESC) AS row_num
      FROM 
        comments
      LEFT JOIN 
        users ON users.id = comments.author
      WHERE 
        comments.parent_id IS NULL
        AND (${sId} = '' OR comments.story_id = ${sId})
        AND (${aId} = '' OR comments.author = ${aId})
      UNION ALL
      SELECT 
        comments.id,
        comments.comment,
        COALESCE(comments.username, users.username) AS username,
        comments.author,
        comments.created_at,
        comments.parent_id,
        comment_tree.ancestors || comments.parent_id,
        ROW_NUMBER() OVER(PARTITION BY COALESCE(comments.parent_id, comments.id)) AS rn,
        comment_tree.row_num
      FROM 
        comments
      JOIN 
        comment_tree ON comments.parent_id = comment_tree.id
      LEFT JOIN 
        users ON users.id = comments.author
    )
    SELECT * FROM comment_tree
    WHERE row_num BETWEEN ((${page}::INTEGER - 1) * ${pageSize}::INTEGER + 1) AND (${page}::INTEGER * ${pageSize}::INTEGER)
  `)) as unknown as { rows: CommentFromDB[] };

  console.debug("commentsFromDB", commentsFromDB);

  // Create a map of comments by their ID
  const commentsMap = new Map<string, CommentWithChildren>();
  commentsFromDB.rows.forEach((comment) => {
    commentsMap.set(comment.id, { ...comment, children: [] });
  });

  // Assign each comment to its parent's `children` array
  commentsFromDB.rows.forEach((comment) => {
    if (comment.parent_id !== null) {
      const parent = commentsMap.get(comment.parent_id);
      if (parent) {
        parent.children?.push(commentsMap.get(comment.id)!);
      }
    }
  });

  // Get the top-level comments (i.e., the parent comments for the current page)
  const topLevelComments = commentsFromDB.rows
    .filter((comment) => comment.parent_id === null)
    .map((comment) => commentsMap.get(comment.id)!);

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
