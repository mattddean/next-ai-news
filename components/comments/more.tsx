import { commentsTable, db } from "@/app/db";
import { sql, count } from "drizzle-orm";
import { MoreCommentsForm } from "./more-form";

export const PER_PAGE = 50;

async function hasMoreComments({
  storyId,
  page,
}: {
  storyId: string;
  page: number;
}) {
  const totalNumComments = (
    await db
      .select({ value: count() })
      .from(commentsTable)
      .where(sql`story_id = ${storyId}`)
      .limit(PER_PAGE)
      .offset(page * PER_PAGE)
  )[0].value;
  return totalNumComments > page * PER_PAGE;
}

async function More({ page, storyId }: { page: number; storyId: string }) {
  const hasMore = await hasMoreComments({
    page,
    storyId,
  });

  if (hasMore) {
    return <MoreCommentsForm page={page + 1} />;
  } else {
    return null;
  }
}
