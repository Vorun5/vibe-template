import { db } from "@/db";
import { items } from "@/db/schema";
import { eq, and, sql, desc, asc, count, ilike } from "drizzle-orm";

// ---------- Types ----------

export interface ItemListItem {
  slug: string;
  name: string;
  views: number;
}

export interface ItemDetail extends ItemListItem {
  createdAt: string;
}

export interface ItemSuggestion {
  slug: string;
  name: string;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ItemListFilters {
  page: number;
  limit: number;
}

// ---------- Drizzle queries ----------

/**
 * Standard listing with pagination — built with the Drizzle query builder.
 *
 * Batch-loading hint: if every item needed nested data (e.g. tags), DO NOT
 * fan out one query per item. Collect the parent IDs, fetch all children in
 * a single `WHERE parent_id IN (...)` query, then map them in-memory.
 */
export async function findItems(
  filters: ItemListFilters,
): Promise<PaginatedResult<ItemListItem>> {
  const whereClause = eq(items.published, true);
  const offset = filters.page * filters.limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        slug: items.slug,
        name: items.name,
        views: items.views,
      })
      .from(items)
      .where(whereClause)
      .orderBy(desc(items.createdAt))
      .limit(filters.limit)
      .offset(offset),
    db.select({ count: count() }).from(items).where(whereClause),
  ]);

  const total = totalResult[0].count;
  return {
    list: rows,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function findItemBySlug(
  slug: string,
): Promise<ItemDetail | null> {
  const row = await db
    .select({
      slug: items.slug,
      name: items.name,
      views: items.views,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(and(eq(items.slug, slug), eq(items.published, true)))
    .limit(1);

  if (!row.length) return null;
  const r = row[0];
  return {
    slug: r.slug,
    name: r.name,
    views: r.views,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function findItemSuggestions(
  q: string,
  limit = 8,
): Promise<ItemSuggestion[]> {
  // ILIKE for case-insensitive prefix-and-contains matching. For larger
  // datasets, swap for a pg_trgm GIN index + % operator (see setup-indexes.ts).
  const pattern = `%${q}%`;
  const rows = await db
    .select({
      slug: items.slug,
      name: items.name,
    })
    .from(items)
    .where(and(eq(items.published, true), ilike(items.name, pattern)))
    .orderBy(desc(items.views))
    .limit(limit);
  return rows;
}

export async function incrementViews(slug: string): Promise<void> {
  await db
    .update(items)
    .set({ views: sql`${items.views} + 1` })
    .where(eq(items.slug, slug));
}

// ---------- Raw SQL with CTE (demo) ----------
//
// Drizzle covers ~90% of queries. Reach for raw SQL when you need recursive
// CTEs, full-text search, or window functions. `db.execute()` returns
// `Record<string, unknown>[]` — cast rows to your concrete type via
// `as unknown as T`.

export interface ItemWithRank {
  slug: string;
  name: string;
  views: number;
  rank: number;
}

export async function findTopItemsByViews(
  limit: number,
): Promise<ItemWithRank[]> {
  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT
        slug,
        name,
        views,
        RANK() OVER (ORDER BY views DESC) AS rank
      FROM items
      WHERE published = true
    )
    SELECT slug, name, views, rank
    FROM ranked
    WHERE rank <= ${limit}
    ORDER BY rank ASC
  `);

  return result.rows.map((r) => {
    const row = r as { slug: string; name: string; views: number; rank: number | string };
    return {
      slug: row.slug,
      name: row.name,
      views: Number(row.views),
      rank: Number(row.rank),
    };
  });
}

// ---------- Internal — used by /internal/items/:slug/info ----------

export interface ItemInternalInfo {
  slug: string;
  name: string;
  published: boolean;
}

export async function findItemInternalInfo(
  slug: string,
): Promise<ItemInternalInfo | null> {
  const row = await db
    .select({
      slug: items.slug,
      name: items.name,
      published: items.published,
    })
    .from(items)
    .where(eq(items.slug, slug))
    .limit(1);

  return row.length ? row[0] : null;
}

// Re-export for tests / callers that want extras.
export { asc };
