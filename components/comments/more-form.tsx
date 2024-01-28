"use client";

import { useFormStatus } from "react-dom";
import { useFormState } from "react-dom";
import { GetMoreCommentsActionData, getMoreCommentsAction } from "./actions";
import { CommentList } from "./list";
import { ErrorMessage } from "@/components/forms";

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
    <>
      {/* first display a "More" button to fetch the comments at page `page` */}
      {(!state.data || state.error) && (
        <form action={formAction} className="max-w-2xl">
          <MoreCommentsFormFields {...state} page={page} storyId={storyId} />
        </form>
      )}

      {/* then display the comments at page `page` after retrieved */}
      {state.data && <CommentList comments={state.data.comments} />}

      {/* and a form to fetch the following page if there is one */}
      {state.data?.hasMore && (
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
        More <span className="md:hidden">results</span>
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
