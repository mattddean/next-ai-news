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
  // TODO: use $withRecursive once it drops:
  // https://github.com/drizzle-team/drizzle-orm/pull/1405
  // TODO: generate the inner part of WITH RECURSIVE using drizzle
  const query = sql`
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
    )`
    .append(sql`,max_level_comments AS (`)
    .append(
      db
        .select({
          id: sql`id`.as("id"),
          max_level: sql`MAX(level)`.as("max_level"),
        })
        .from(sql`dfs_comments`)
        .groupBy(sql`id`)
        .getSQL()
    )
    .append(sql`)`)
    .append(
      db
        .select({
          id: sql<Comment["id"]>`dfs_comments.id`,
          story_id: sql<Comment["story_id"]>`dfs_comments.story_id`,
          author_username: sql<
            Comment["author_username"]
          >`${usersTable.username}`.as("author_username"),
          username: sql<Comment["username"]>`dfs_comments.username`,
          comment: sql<Comment["comment"]>`dfs_comments.comment`,
          parent_id: sql<Comment["parent_id"]>`dfs_comments.parent_id`,
          author: sql<Comment["author"]>`dfs_comments.author`,
          created_at: sql<Comment["created_at"]>`dfs_comments.created_at`,
          updated_at: sql<Comment["updated_at"]>`dfs_comments.updated_at`,
          level: sql<Comment["level"]>`dfs_comments.level`,
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

  const rows = (await db.execute<Comment>(query)).rows;

  return rows;
}

// TODO: can we infer this?
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
