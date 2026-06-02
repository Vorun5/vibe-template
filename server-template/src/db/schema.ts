import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * Example resource — demonstrates the full Routes → Services → Repositories
 * stack. Replace with your own tables.
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug").notNull().unique(),
    name: varchar("name").notNull(),
    published: boolean("published").notNull().default(false),
    views: integer("views").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    publishedIdx: index("items_published_idx").on(table.published),
  }),
);

export const table = { items } as const;
export type Table = typeof table;
