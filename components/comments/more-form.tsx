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
  const [state, formAction] = useFormState(getMoreCommentsAction, undefined);

  return (
    <>
      {state?.data && <CommentList comments={state.data.comments} />}

      {(!state || state.error) && (
        <form action={formAction} className="max-w-2xl">
          <MoreCommentsFormFields {...state} page={page} storyId={storyId} />
        </form>
      )}

      {state?.data?.hasMore && (
        <MoreCommentsForm
          page={page + 1}
          storyId={storyId}
          authorId={authorId}
        />
      )}
    </>
  );
}

function MoreCommentsFormFields({
  data,
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

  return (
    <div className="space-y-4 py-1">
      <input type="hidden" name="storyId" value={storyId} />
      <input type="hidden" name="authorId" value={authorId} />
      <input type="hidden" name="page" value={page} />
      <button
        className="text-md hover:underline text-[#666] md:text-gray-500"
        disabled={pending}
        type="submit"
      >
        More (for page ${page})
      </button>
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
