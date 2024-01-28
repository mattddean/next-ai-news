import {
  commentsTable,
  db,
  genStoryId,
  storiesTable,
  genCommentId,
  genUserId,
  usersTable,
} from "@/app/db";
import { sql } from "drizzle-orm";

// Function to generate a random number between min and max (inclusive)
function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to generate a random date within the last week
function getRandomDateWithinLastWeek(): Date {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return new Date(getRandomNumber(oneWeekAgo.getTime(), now.getTime()));
}

// Function to seed the database with stories
async function seedDatabase(): Promise<void> {
  const numberOfStories = 3; // Change this to the desired number of stories
  const commentsPerStory = 12;
  const subCommentsPerComment = 5;
  const subSubCommentsPerSubComment = 2;
  const numUsers = 2;

  const userIds = [];
  for (let i = 0; i < numUsers; i++) {
    const userId = genUserId();
    userIds.push(userId);
    await db.insert(usersTable).values({
      id: userId,
      username: userId,
      email: userId + "@example.com",
      password: "password",
    });
  }

  for (let i = 0; i < numberOfStories; i++) {
    const points = getRandomNumber(0, 500);
    const createdAt = getRandomDateWithinLastWeek();

    const storyId = genStoryId();

    await db.insert(storiesTable).values({
      id: storyId,
      title: `Story ${i + 1}`,
      type: "story",
      points,
      created_at: createdAt,
    });

    for (let j = 0; j < commentsPerStory; j++) {
      const commentCreatedAt = getRandomDateWithinLastWeek();
      const commentId = genCommentId();

      await db.insert(commentsTable).values({
        id: commentId,
        story_id: storyId,
        parent_id: null,
        comment: `Comment ${j + 1} on story ${i + 1}`,
        created_at: commentCreatedAt,
        author: userIds[getRandomNumber(0, numUsers - 1)],
      });

      for (let k = 0; k < subCommentsPerComment; k++) {
        const subCommentCreatedAt = getRandomDateWithinLastWeek();
        const subCommentId = genCommentId();

        await db.insert(commentsTable).values({
          comment: `Sub-comment ${k + 1} on comment ${j + 1} on story ${i + 1}`,
          created_at: subCommentCreatedAt,
          id: subCommentId,
          parent_id: commentId,
          story_id: storyId,
          author: userIds[getRandomNumber(0, numUsers - 1)],
        });

        for (let l = 0; l < subSubCommentsPerSubComment; l++) {
          const subSubCommentCreatedAt = getRandomDateWithinLastWeek();
          const subSubCommentId = genCommentId();

          await db.insert(commentsTable).values({
            comment: `Sub-sub-comment ${l + 1} on sub-comment ${
              k + 1
            } on comment ${j + 1} on story ${i + 1}`,
            created_at: subSubCommentCreatedAt,
            id: subSubCommentId,
            parent_id: subCommentId,
            story_id: storyId,
            author: userIds[getRandomNumber(0, numUsers - 1)],
          });
        }
      }
    }

    const commentCount =
      commentsPerStory * subCommentsPerComment * subSubCommentsPerSubComment;
    await db
      .update(storiesTable)
      .set({ comments_count: commentCount ?? 0 })
      .where(sql`${storiesTable.id} = ${storyId}`);
  }

  console.log(`Seeded the database with ${numberOfStories} stories.`);
}

seedDatabase().catch((error) => {
  console.error("Error seeding the database:", error);
});
