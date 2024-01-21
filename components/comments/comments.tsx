import { headers } from "next/headers";
import { auth } from "@/app/auth";
import { nanoid } from "nanoid";
import { getComments } from "./actions";
import { CommentList } from "./list";
import { MoreCommentsForm } from "./more-form";
import { Suspense } from "react";

export async function Comments({
  storyId,
  author,
}: {
  storyId?: string;
  author?: string;
}) {
  const session = await auth();
  const rid = headers().get("x-vercel-id") ?? nanoid();

  console.time(`fetch comments ${storyId} (req: ${rid})`);
  const comments = await getComments({
    // storyId: storyId,
    author: "user_8xcDYYj6cKWb",
  });
  console.timeEnd(`fetch comments ${storyId} (req: ${rid})`);

  return comments.length === 0 ? (
    <div>No comments to show</div>
  ) : (
    <CommentList
      loggedInUserId={session?.user?.id}
      comments={comments}
      MoreComments={
        <Suspense fallback={null}>
          <MoreCommentsForm page={1} storyId={storyId} />
        </Suspense>
      }
    />
  );
}
