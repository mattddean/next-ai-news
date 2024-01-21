import {
  commentsTable,
  db,
  genStoryId,
  storiesTable,
  genCommentId,
  commentsClosureTable,
  genCommentClosureId,
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

async function insertCommentClosureSelfRow(commentId: string) {
  await db.insert(commentsClosureTable).values({
    id: genCommentClosureId(),
    ancestor_id: commentId,
    descendant_id: commentId,
    depth: 0,
  });
}

async function insertCommentAndClosureRows({
  newCommentId,
  parentCommentId,
  createdAt,
  storyId,
  comment,
}: {
  newCommentId: string;
  parentCommentId: string;
  createdAt: Date;
  storyId: string;
  comment: string;
}) {
  await db.insert(commentsTable).values({
    id: newCommentId,
    story_id: storyId,
    parent_id: parentCommentId,
    comment: comment,
    created_at: createdAt,
  });
  // Insert rows for the ancestors of the parent comment
  const ancestorRows = await db
    .select({
      ancestor_id: commentsClosureTable.ancestor_id,
      depth: commentsClosureTable.depth,
    })
    .from(commentsClosureTable)
    .where(sql`${commentsClosureTable.descendant_id} = ${parentCommentId}`);
  for (const row of ancestorRows) {
    await db.insert(commentsClosureTable).values({
      id: genCommentClosureId(),
      ancestor_id: row.ancestor_id,
      descendant_id: newCommentId,
      depth: row.depth + 1,
    });
  }
  // Insert row for the new comment itself
  await insertCommentClosureSelfRow(newCommentId);
}

// Function to seed the database with stories
async function seedDatabase(): Promise<void> {
  const numberOfStories = 3; // Change this to the desired number of stories
  const commentsPerStory = 12;
  const subCommentsPerComment = 5;
  const subSubCommentsPerSubComment = 2;

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
      });
      await insertCommentClosureSelfRow(commentId);

      for (let k = 0; k < subCommentsPerComment; k++) {
        const subCommentCreatedAt = getRandomDateWithinLastWeek();
        const subCommentId = genCommentId();

        await insertCommentAndClosureRows({
          comment: `Sub-comment ${k + 1} on comment ${j + 1} on story ${i + 1}`,
          createdAt: subCommentCreatedAt,
          newCommentId: subCommentId,
          parentCommentId: commentId,
          storyId,
        });

        for (let l = 0; l < subSubCommentsPerSubComment; l++) {
          const subSubCommentCreatedAt = getRandomDateWithinLastWeek();
          const subSubCommentId = genCommentId();

          await insertCommentAndClosureRows({
            comment: `Sub-sub-comment ${l + 1} on sub-comment ${
              k + 1
            } on comment ${j + 1} on story ${i + 1}`,
            createdAt: subSubCommentCreatedAt,
            newCommentId: subSubCommentId,
            parentCommentId: subCommentId,
            storyId,
          });

          // await db.execute(sql`
          //   INSERT INTO comments_closure (id, ancestor_id, descendant_id, depth)
          //   SELECT ${genCommentClosureId()}, ancestor_id, ${subSubCommentId}, depth + 1
          //   FROM comments_closure
          //   WHERE descendant_id = ${subCommentId}
          //   UNION ALL
          //   SELECT ${genCommentClosureId()}, ${subSubCommentId}, ${subSubCommentId}, 0;`);
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
