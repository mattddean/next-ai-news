import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import {
  pgTable,
  text,
  index,
  integer,
  varchar,
  timestamp,
  AnyPgColumn,
  unique,
} from "drizzle-orm/pg-core";
import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";
import { sql } from "drizzle-orm";
import ws from "ws";
// import { Pool } from "pg";

// init nanoid
const nanoid = customAlphabet(nolookalikes, 12);

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL environment variable is not set");
}

neonConfig.fetchConnectionCache = true;

if (process.env.VERCEL_ENV !== "production") {
  neonConfig.webSocketConstructor = ws;
  // Set the WebSocket proxy to work with the local instance
  neonConfig.wsProxy = (host) => {
    return `${host}:5433/v1`;
  };
  // Disable all authentication and encryption
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

// let db;
// if (process.env.NODE_ENV === "development") {
//   const client = new Pool({
//     connectionString: process.env.POSTGRES_URL,
//   });
//   await client.connect();
//   db = pgDrizzle(client);
// } else {
//   db = neonDrizzle(
//     neon(process.env.POSTGRES_URL, {
//       fetchOptions: {
//         cache: "no-store",
//       },
//     })
//   );
// }
// export { db };

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const db = drizzle(pool);

export const usersTable = pgTable(
  "users",
  {
    id: varchar("id", { length: 256 }).primaryKey().notNull(),
    username: varchar("username", { length: 256 }).notNull().unique(),
    email: varchar("email", { length: 256 }),
    karma: integer("karma").notNull().default(0),
    password: varchar("password", { length: 256 }).notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    username_idx: index("username_idx").on(t.username),
  })
);

export const genUserId = () => {
  return `user_${nanoid(12)}`;
};

export const storiesTable = pgTable(
  "stories",
  {
    id: varchar("id", { length: 256 }).primaryKey().notNull(),
    type: varchar("type", { enum: ["show", "jobs", "ask", "story"] }).notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    text: text("text"),
    url: varchar("url", { length: 256 }),
    domain: varchar("domain", { length: 256 }),
    username: varchar("username", { length: 256 }),
    points: integer("points").notNull().default(0),
    submitted_by: varchar("submitted_by", { length: 256 }).references(
      () => usersTable.id,
      { onDelete: "set null" }
    ),
    comments_count: integer("comments_count").notNull().default(0),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    trgm_idx: index("trgm_idx")
      .on(t.title)
      .concurrently()
      .using(sql`gin (title gin_trgm_ops)`),
    created_at_idx: index("created_at_idx").on(t.created_at),
    type_idx: index("type_idx").on(t.type),
  })
);

export const genStoryId = () => {
  return `story_${nanoid(12)}`;
};

export const commentsTable = pgTable(
  "comments",
  {
    id: varchar("id", { length: 256 }).primaryKey().notNull(),
    story_id: varchar("story_id", { length: 256 })
      .notNull()
      .references(() => storiesTable.id),
    parent_id: varchar("parent_id", { length: 256 }).references(
      (): AnyPgColumn => commentsTable.id
    ),
    username: varchar("username", { length: 256 }),
    comment: text("comment").notNull(),
    author: varchar("author", { length: 256 }).references(() => usersTable.id, {
      onDelete: "set null",
    }),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    created_at_idx: index("c_created_at_idx").on(t.created_at),
    story_id_idx: index("c_story_id_idx").on(t.story_id),
    author_idx: index("c_author_idx").on(t.author),
    parent_id_idx: index("c_parent_id_idx").on(t.parent_id),
  })
);

export const genCommentId = () => {
  return `comment_${nanoid(12)}`;
};
