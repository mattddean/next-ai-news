"use server";

import { z } from "zod";
import { getComments, hasMoreComments, type Comment } from "./queries";

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
  data?: {
    comments: Comment[];
    hasMore: boolean;
  };
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
    // return generic error because the hidden fields are
    // immaterial to the user
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again later",
      },
    };
  }

  try {
    const [comments, hasMore] = await Promise.all([
      getComments({
        storyId: input.data.storyId,
        authorId: input.data.authorId,
        page: input.data.page,
      }),
      hasMoreComments({
        storyId: input.data.storyId,
        authorId: input.data.authorId,
        page: input.data.page,
      }),
    ]);
    return {
      data: {
        comments,
        hasMore,
      },
    };
  } catch (err) {
    console.error(err);
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get comments. Please try again later",
      },
    };
  }
}
