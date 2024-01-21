import { commentsTable, db, storiesTable } from "@/app/db";
import { count, sql } from "drizzle-orm";

// Function to seed the database with stories
async function seedDatabase(): Promise<void> {
  const allStories = await db.select().from(storiesTable);

  for (const story of allStories) {
    const commentCount = (
      await db
        .select({ value: count() })
        .from(commentsTable)
        .where(sql`${commentsTable.story_id} = ${story.id}`)
        .limit(1)
    )[0];

    await db
      .update(storiesTable)
      .set({ comments_count: commentCount.value ?? 0 })
      .where(sql`${storiesTable.id} = ${story.id}`);
  }

  console.log(`Added comment counts`);
}

seedDatabase().catch((error) => {
  console.error("Error seeding the database:", error);
});
