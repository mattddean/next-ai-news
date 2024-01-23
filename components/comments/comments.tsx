import { headers } from "next/headers";
import { auth } from "@/app/auth";
import { nanoid } from "nanoid";
import { getComments, hasMoreComments } from "./queries";
import { CommentList } from "./list";
import { MoreCommentsForm } from "./more-form";
import { Suspense } from "react";

export async function Comments({
  storyId,
  authorId,
}: {
  storyId?: string;
  authorId?: string;
}) {
  const session = await auth();
  const rid = headers().get("x-vercel-id") ?? nanoid();

  console.time(`fetch comments ${storyId} (req: ${rid})`);
  const comments = await getComments({
    storyId,
    authorId,
    page: 1,
  });
  console.timeEnd(`fetch comments ${storyId} (req: ${rid})`);

  return comments.length === 0 ? (
    <div>No comments to show</div>
  ) : (
    <div className="flex flex-col gap-3">
      <CommentList loggedInUserId={session?.user?.id} comments={comments} />
      <Suspense fallback={null}>
        <MoreComments storyId={storyId} authorId={authorId} />
      </Suspense>
    </div>
  );
}

async function MoreComments({
  storyId,
  authorId,
}: {
  storyId?: string;
  authorId?: string;
}) {
  const hasMore = await hasMoreComments({
    storyId,
    authorId,
    page: 2,
  });

  if (!hasMore) {
    return null;
  }

  return <MoreCommentsForm page={2} storyId={storyId} />;
}
