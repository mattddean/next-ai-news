import { commentsTable, db, usersTable } from "@/app/db";
import { sql } from "drizzle-orm";

const PER_PAGE = 50;

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
  // Define the recursive part of the query using raw SQL
  const recursivePart = sql`
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
    )`;

  // Continue building the rest of the query using Drizzle ORM
  const result = db
    .select({
      id: sql<string>`dfs_comments.id`,
      story_id: sql<string>`dfs_comments.story_id`,
      ancestor_id: sql<string>`dfs_comments.ancestor_id`,
      username: sql<string>`dfs_comments.author_username`,
      author_username: usersTable.username,
      comment: sql<string>`dfs_comments.comment`,
      parent_id: sql<string>`dfs_comments.parent_id`,
      author: sql<string>`dfs_comments.author`,
      created_at: sql<Date>`dfs_comments.created_at`,
      updated_at: sql<Date>`dfs_comments.updated_at`,
      level: sql<number>`dfs_comments.level`,
    })
    .from(recursivePart) // Use the raw SQL as part of the query
    .innerJoin(
      sql`max_level_comments`,
      sql`dfs_comments.id = max_level_comments.id`
    )
    .where(sql`dfs_comments.level = max_level_comments.max_level`)
    .leftJoin(usersTable, sql`${usersTable.id} = dfs_comments.author`)
    .orderBy(sql`path`)
    .offset((page - 1) * PER_PAGE)
    .limit(PER_PAGE);

  return result;
}
export type Comment = Awaited<ReturnType<typeof getComments>>[number];

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
