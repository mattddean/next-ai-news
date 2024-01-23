import { commentsTable, db } from "@/app/db";
import { sql, count } from "drizzle-orm";

const PER_PAGE = 50;

export type CommentFromDB = {
  id: string;
  story_id: string;
  ancestor_id: string;
  author_username: string | null;
  username: string | null;
  comment: string;
  parent_id: string | null;
  author: null;
  created_at: Date;
  updated_at: Date;
  depth: number;
  level: number;
};

export async function getComments({
  storyId,
  authorId,
  page,
}: {
  storyId?: string;
  authorId?: string;
  page: number;
}) {
  const sId = storyId ?? "";
  const aId = authorId ?? "";

  // fetch comments by story or author. if both
  // are provided, only fetch by story. use
  // max_level_comments to avoid fetching duplicate
  // comments when querying by author.
  // TODO: as a performance optimization, consider
  // using two distinct queries: one for story and
  // one for author, including the max_level_comments
  // part only for the author query.
  const comments = (
    await db.execute<CommentFromDB>(sql`
      WITH RECURSIVE dfs_comments AS (
        SELECT 
          comments.*,
          ARRAY[comments.created_at] AS path,
          1 AS level
        FROM 
          comments
        WHERE 
          (${sId} <> '' AND comments.story_id = ${sId} AND comments.parent_id IS NULL)
          OR 
          (${aId} <> '' AND comments.author = ${aId})
        
        UNION ALL

        SELECT 
          comments.*,
          path || comments.created_at,
          level + 1
        FROM 
          comments
        JOIN 
          dfs_comments ON comments.parent_id = dfs_comments.id
      ),
      max_level_comments AS (
        SELECT 
          id, 
          MAX(level) as max_level
        FROM 
          dfs_comments
        GROUP BY 
          id
      )
      SELECT 
        dfs_comments.*,
        users.username AS author_username
      FROM dfs_comments
      JOIN max_level_comments ON dfs_comments.id = max_level_comments.id AND dfs_comments.level = max_level_comments.max_level
      LEFT JOIN users ON users.id = dfs_comments.author
      ORDER BY path
      OFFSET ${(page - 1) * PER_PAGE}
      LIMIT ${PER_PAGE};
    `)
  ).rows;

  return comments;
}

export async function hasMoreComments({
  storyId,
  // TODO
  authorId,
  page,
}: {
  storyId?: string;
  authorId?: string;
  page: number;
}) {
  const comments = await db
    .select({
      id: commentsTable.id,
    })
    .from(commentsTable)
    .where(sql`story_id = ${storyId}`)
    .limit(1)
    .offset(page * PER_PAGE);
  return comments.length > 0;
}
