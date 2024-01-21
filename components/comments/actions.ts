"use server";

import { db } from "@/app/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

const GetMoreCommentsActionSchema = z.object({
  page: z.preprocess((val) => Number(val), z.number().positive()),
  storyId: z.string().optional(),
  authorId: z.string().optional(),
});

export type GetMoreCommentsActionData = {
  error?:
    | {
        code: "INTERNAL_ERROR";
        message: string;
      }
    | {
        code: "VALIDATION_ERROR";
        fieldErrors: {
          [field: string]: string[];
        };
      };
  comments?: CommentFromDB[];
};

export async function getMoreCommentsAction(
  _prevState: any,
  formData: FormData
): Promise<GetMoreCommentsActionData> {
  const input = GetMoreCommentsActionSchema.safeParse({
    page: formData.get("page"),
    storyId: formData.get("storyId"),
    authorId: formData.get("authorId"),
  });

  if (!input.success) {
    const { fieldErrors } = input.error.flatten();
    return {
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors,
      },
    };
  }

  try {
    const page = input.data.page;
    const comments = await getComments({
      storyId: input.data.storyId,
      page: input.data.page,
    });
    return { comments };
  } catch (err) {
    console.error(err);
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get comments",
      },
    };
  }
}

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
      OFFSET ${offset}
      LIMIT ${totalCommentsLimit};
    `)
  ).rows;

  return comments;
}
