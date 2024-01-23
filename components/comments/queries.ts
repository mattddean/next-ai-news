import { commentsTable, db, usersTable } from "@/app/db";
import { max, sql } from "drizzle-orm";

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
  const withThing = sql`
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
    ), `
    .append(sql`max_level_comments AS (`)
    .append(
      db
        .select({
          id: sql`id`,
          max_level: sql`MAX(level)`.as("max_level"),
        })
        .from(sql`dfs_comments`)
        .groupBy(sql`id`)
        .getSQL()
    )
    .append(sql`) `)
    .append(
      db
        .select({
          id: sql<string>`dfs_comments.id`,
          story_id: sql<string>`dfs_comments.story_id`,
          // ancestor_id: sql<string>`dfs_comments.ancestor_id`,
          username: sql<string>`dfs_comments.username`,
          author_username: usersTable.username,
          comment: sql<string>`dfs_comments.comment`,
          parent_id: sql<string>`dfs_comments.parent_id`,
          author: sql<string>`dfs_comments.author`,
          created_at: sql<string>`dfs_comments.created_at`,
          updated_at: sql<string>`dfs_comments.updated_at`,
          level: sql<number>`dfs_comments.level`,
        })
        .from(sql`dfs_comments`)
        .innerJoin(
          sql`max_level_comments`,
          sql`dfs_comments.id = max_level_comments.id`
        )
        .where(sql`dfs_comments.level = max_level_comments.max_level`)
        .leftJoin(usersTable, sql`${usersTable.id} = dfs_comments.author`)
        .orderBy(sql`path`)
        .offset((page - 1) * PER_PAGE)
        .limit(PER_PAGE)
        .getSQL()
    );

  const result = await db.execute(withThing);

  // console.debug("result", result.rows);

  const row1 = result.rows[0];
  console.debug("created at", typeof row1.created_at);

  return result.rows;
}

// TODO: infer this
export type Comment = {
  id: string;
  story_id: string;
  author_username: string | null;
  username: string | null;
  comment: string;
  parent_id: string | null;
  author: null;
  created_at: Date;
  updated_at: Date;
  level: number;
};

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
