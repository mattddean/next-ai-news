import { db, usersTable, storiesTable } from "@/app/db";
import { TimeAgo } from "@/components/time-ago";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { sql } from "drizzle-orm";
import { Suspense } from "react";
import { Comments } from "@/components/comments/comments";
import { ReplyForm } from "./reply-form";
import Link from "next/link";

export const metadata = {
  openGraph: {
    title: "Next AI News",
    url: "https://next-ai-news.vercel.app",
    siteName: "Next AI News",
  },
  twitter: {
    title: "Next AI News",
    card: "summary_large_image",
    site: "@rauchg",
    creator: "@rauchg",
  },
};

const getStory = async function getStory(idParam: string) {
  const id = `story_${idParam}`;
  return (
    await db
      .select({
        id: storiesTable.id,
        title: storiesTable.title,
        domain: storiesTable.domain,
        url: storiesTable.url,
        username: storiesTable.username,
        points: storiesTable.points,
        submitted_by: usersTable.username,
        comments_count: storiesTable.comments_count,
        created_at: storiesTable.created_at,
      })
      .from(storiesTable)
      .where(sql`${storiesTable.id} = ${id}`)
      .limit(1)
      .leftJoin(
        usersTable,
        sql`${usersTable.id} = ${storiesTable.submitted_by}`
      )
  )[0];
};

/**
 * This code was generated by v0 by Vercel.
 * @see https://v0.dev/r/0CgFbz6suAU
 */

export default async function ItemPage({
  params: { id: idParam },
}: {
  params: { id: string };
}) {
  const rid = headers().get("x-vercel-id") ?? nanoid();

  console.time(`fetch story ${idParam} (req: ${rid})`);
  const story = await getStory(idParam);
  console.timeEnd(`fetch story ${idParam} (req: ${rid})`);

  if (!story) {
    notFound();
  }

  const now = Date.now();
  return (
    <div className="px-3">
      <div className="mb-4 flex items-start">
        <div className="flex flex-col items-center mr-1 gap-y-1">
          <svg
            height="12"
            viewBox="0 0 32 16"
            width="12"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="m2 27 14-29 14 29z" fill="#999" />
          </svg>
        </div>
        <div className="flex-grow">
          {story.url != null ? (
            <a
              className="text-[#000000] hover:underline"
              rel={"nofollow noreferrer"}
              target={"_blank"}
              href={story.url}
            >
              {story.title}
            </a>
          ) : (
            <Link
              prefetch={true}
              href={`/item/${story.id.replace(/^story_/, "")}`}
              className="text-[#000000] hover:underline"
            >
              {story.title}
            </Link>
          )}

          {story.domain && (
            <span className="text-xs ml-1 text-[#666] md:text-[#828282]">
              ({story.domain})
            </span>
          )}

          <p className="text-xs text-[#666] md:text-[#828282]">
            {story.points} point{story.points > 1 ? "s" : ""} by{" "}
            {story.submitted_by ?? story.username}{" "}
            <TimeAgo now={now} date={story.created_at} />{" "}
            <span aria-hidden={true}>| </span>
            <span className="cursor-default" title="Not implemented">
              flag
            </span>{" "}
            <span aria-hidden={true}>| </span>
            <span className="cursor-default" title="Not implemented">
              hide
            </span>{" "}
            <span aria-hidden={true}>| </span>
            <Link
              prefetch={true}
              className="hover:underline"
              href={`/item/${story.id.replace(/^story_/, "")}`}
            >
              {story.comments_count} comments
            </Link>
          </p>
          <div className="my-4 max-w-2xl space-y-3">
            <ReplyForm storyId={story.id} />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <Comments storyId={story.id} />
      </Suspense>
    </div>
  );
}
