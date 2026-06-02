/**
 * Integration tests for item.service against the real (seeded) DB.
 *
 * NOTE: Bun's `mock.module` is process-global — any module mock in a sibling
 * test file would leak into api.test.ts and break the DB-backed integration
 * suite. So this file avoids mocking and just exercises the service against
 * the real items table. Run with the same DATABASE_URL as api.test.ts.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import {
  getItemSuggestions,
  getItems,
  getItemBySlug,
  warmupItemsCache,
  getTopItems,
  __resetCacheForTests,
} from "@/services/item.service";
import { db } from "@/db";
import { items } from "@/db/schema";
import { eq } from "drizzle-orm";

let seedSlug: string;

beforeAll(async () => {
  const row = await db
    .select({ slug: items.slug })
    .from(items)
    .where(eq(items.published, true))
    .limit(1);
  if (!row.length) throw new Error("No published items in DB — cannot run service tests");
  seedSlug = row[0].slug;
});

// ============================================================
// getItemSuggestions — short-query guard
// ============================================================

describe("getItemSuggestions — guards", () => {
  it("returns [] for empty query", async () => {
    expect(await getItemSuggestions("")).toEqual([]);
  });

  it("returns [] for single-character query", async () => {
    expect(await getItemSuggestions("a")).toEqual([]);
  });

  it("returns [] for whitespace-only query", async () => {
    expect(await getItemSuggestions("   ")).toEqual([]);
  });

  it("returns suggestions for a valid query", async () => {
    const result = await getItemSuggestions("we"); // matches "welcome"
    expect(Array.isArray(result)).toBe(true);
    // Every entry must have just slug + name.
    for (const s of result) {
      expect(Object.keys(s).sort()).toEqual(["name", "slug"]);
      expect(typeof s.slug).toBe("string");
      expect(typeof s.name).toBe("string");
    }
  });

  it("trims whitespace before dispatching", async () => {
    const trimmed = await getItemSuggestions("we");
    const padded = await getItemSuggestions("  we  ");
    expect(padded.map((s) => s.slug).sort()).toEqual(
      trimmed.map((s) => s.slug).sort(),
    );
  });
});

// ============================================================
// getItems — pagination shape
// ============================================================

describe("getItems", () => {
  it("returns paginated shape", async () => {
    const result = await getItems({ page: 0, limit: 5 });
    expect(typeof result.total).toBe("number");
    expect(result.page).toBe(0);
    expect(result.limit).toBe(5);
    expect(Array.isArray(result.list)).toBe(true);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("respects limit", async () => {
    const result = await getItems({ page: 0, limit: 3 });
    expect(result.list.length).toBeLessThanOrEqual(3);
  });
});

// ============================================================
// getItemBySlug
// ============================================================

describe("getItemBySlug", () => {
  it("returns the detail for a seeded slug", async () => {
    const result = await getItemBySlug(seedSlug);
    expect(result).not.toBeNull();
    expect(result?.slug).toBe(seedSlug);
  });

  it("returns null for unknown slug (does not throw)", async () => {
    const result = await getItemBySlug("definitely-does-not-exist-1234");
    expect(result).toBeNull();
  });
});

// ============================================================
// warmupItemsCache + getTopItems
// ============================================================

describe("getTopItems / warmupItemsCache", () => {
  it("returns at most `limit` items", async () => {
    __resetCacheForTests();
    const a = await getTopItems(5);
    expect(a.length).toBeLessThanOrEqual(5);
    for (const item of a) {
      expect(typeof item.rank).toBe("number");
      expect(item.rank).toBeGreaterThan(0);
    }
  });

  it("warmupItemsCache populates the cache and second call uses it", async () => {
    __resetCacheForTests();
    await warmupItemsCache();
    const a = await getTopItems(3);
    const b = await getTopItems(3);
    expect(a).toEqual(b);
  });
});
