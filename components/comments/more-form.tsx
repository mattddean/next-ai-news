"use client";

import { useFormStatus } from "react-dom";
import { useFormState } from "react-dom";
import { GetMoreCommentsActionData, getMoreCommentsAction } from "./actions";
import { CommentList } from "./list";

export function MoreCommentsForm({
  page,
  storyId,
  authorId,
}: {
  page: number;
  storyId?: string;
  authorId?: string;
}) {
  const [state, formAction] = useFormState(getMoreCommentsAction, {});

  return (
    <form action={formAction} className="max-w-2xl">
      <MoreCommentsFormFields {...state} page={page} storyId={storyId} />
    </form>
  );
}

export function MoreCommentsFormFields({
  comments,
  error,
  storyId,
  authorId,
  page,
}: GetMoreCommentsActionData & {
  page: number;
  storyId?: string;
  authorId?: string;
}) {
  const { pending } = useFormStatus();

  console.debug("pending", pending);

  if (comments) {
    console.debug("did get comments");
    return (
      <CommentList
        comments={comments}
        MoreComments={
          <MoreCommentsForm
            page={page + 1}
            storyId={storyId}
            authorId={authorId}
          />
        }
      />
    );
  }

  console.debug("error", error);

  return (
    <div className="space-y-4 py-1">
      <input type="hidden" name="storyId" value={storyId} />
      <input type="hidden" name="authorId" value={authorId} />
      <input type="hidden" name="page" value={page} />
      <div className="flex flex-col flex-grow sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 items-start md:items-center">
        <label
          className="block text-sm font-medium text-gray-700 md:w-16 md:text-right"
          htmlFor="title"
        >
          Title
        </label>
        <button
          className="text-md hover:underline text-[#666] md:text-gray-500"
          disabled={pending}
          type="submit"
        >
          More
        </button>
      </div>
      {!pending &&
      error &&
      "fieldErrors" in error &&
      error.fieldErrors.title != null ? (
        <ErrorMessage errors={error.fieldErrors.title} />
      ) : null}
    </div>
  );
}

function ErrorMessage({ errors }: { errors: string[] }) {
  return (
    <div className="flex flex-col sm:flex-row sm:space-y-0 sm:space-x-4 items-start">
      <div className="w-16" />
      <div className="mt-1 text-md text-red-500">
        {errors.map((error) => (
          <div key={error}>{error}</div>
        ))}
      </div>
    </div>
  );
}
