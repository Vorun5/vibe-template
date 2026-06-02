/**
 * Integration tests for the public API.
 *
 * Tests use Hono's app.fetch directly — no real HTTP server needed.
 * All tests are read-only: no INSERT / UPDATE / DELETE executed.
 *
 * Checks per endpoint:
 *   1. HTTP status code
 *   2. All required fields are present
 *   3. No extra (unexpected) fields are returned
 *   4. Field types match the contract
 */

import { describe, it, expect, beforeAll } from "bun:test";
import app from "@/index";
import { db } from "@/db";
import { items } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------- Helpers ----------

async function get(path: string): Promise<Response> {
  const url = `http://localhost${path}`;
  return app.fetch(new Request(url, { method: "GET" }));
}

async function json<T>(path: string): Promise<{ status: number; body: T }> {
  const res = await get(path);
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

/** Assert that `obj` has exactly the keys in `expectedKeys` — no more, no less. */
function assertExactKeys(
  obj: Record<string, unknown>,
  expectedKeys: string[],
  label = "",
): void {
  const actual = Object.keys(obj).sort();
  const expected = [...expectedKeys].sort();
  expect(actual).toEqual(expected);
  if (label) {
    expect({ label, actual }).toEqual({ label, actual: expected });
  }
}

// ---------- Seed data (read-only, fetched once) ----------

let itemSlug: string;

beforeAll(async () => {
  const row = await db
    .select({ slug: items.slug })
    .from(items)
    .where(eq(items.published, true))
    .limit(1);

  if (!row.length) {
    throw new Error("No published items in DB — cannot run tests");
  }
  itemSlug = row[0].slug;
});

// ============================================================
// Health
// ============================================================

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const { status, body } = await json<{ status: string }>("/health");
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    assertExactKeys(body as Record<string, unknown>, ["status"]);
  });
});

// ============================================================
// Items — GET /api/v1/items
// ============================================================

describe("GET /api/v1/items", () => {
  const ITEM_LIST_ITEM_KEYS = ["slug", "name", "views"];
  const PAGINATED_KEYS = ["list", "total", "page", "limit", "totalPages"];

  it("returns paginated result with correct top-level shape", async () => {
    const { status, body } =
      await json<Record<string, unknown>>("/api/v1/items?limit=5");
    expect(status).toBe(200);
    assertExactKeys(body, PAGINATED_KEYS);
    expect(typeof body.total).toBe("number");
    expect(typeof body.page).toBe("number");
    expect(typeof body.limit).toBe("number");
    expect(typeof body.totalPages).toBe("number");
    expect(Array.isArray(body.list)).toBe(true);
  });

  it("each item in list has exactly the ItemListItem fields", async () => {
    const { body } = await json<{ list: Record<string, unknown>[] }>(
      "/api/v1/items?limit=5",
    );

    for (const item of body.list) {
      assertExactKeys(item, ITEM_LIST_ITEM_KEYS);
      expect(typeof item.slug).toBe("string");
      expect(typeof item.name).toBe("string");
      expect(typeof item.views).toBe("number");
      expect("id" in item).toBe(false);
      expect("published" in item).toBe(false);
    }
  });

  it("respects page and limit params", async () => {
    const { body: p0 } = await json<{ list: { slug: string }[] }>(
      "/api/v1/items?page=0&limit=2",
    );
    const { body: p1 } = await json<{ list: { slug: string }[] }>(
      "/api/v1/items?page=1&limit=2",
    );
    expect(p0.list.length).toBeLessThanOrEqual(2);
    expect(p1.list.length).toBeLessThanOrEqual(2);

    if (p0.list.length === 2 && p1.list.length > 0) {
      expect(p0.list[0].slug).not.toBe(p1.list[0].slug);
    }
  });

  it("rejects invalid limit", async () => {
    const { status } = await get("/api/v1/items?limit=999");
    expect(status).toBe(400);
  });

  it("rejects negative page", async () => {
    const { status } = await get("/api/v1/items?page=-1");
    expect(status).toBe(400);
  });
});

// ============================================================
// Items — GET /api/v1/items/:slug
// ============================================================

describe("GET /api/v1/items/:slug", () => {
  const ITEM_DETAIL_KEYS = ["slug", "name", "views", "createdAt"];

  it("returns ItemDetail with exactly the right fields", async () => {
    const { status, body } = await json<Record<string, unknown>>(
      `/api/v1/items/${itemSlug}`,
    );
    expect(status).toBe(200);
    assertExactKeys(body, ITEM_DETAIL_KEYS);
    expect(typeof body.slug).toBe("string");
    expect(typeof body.name).toBe("string");
    expect(typeof body.views).toBe("number");
    expect(typeof body.createdAt).toBe("string");
    expect("id" in body).toBe(false);
    expect("published" in body).toBe(false);
  });

  it("returns 404 for non-existent slug", async () => {
    const { status, body } = await json<{ error: string }>(
      "/api/v1/items/this-slug-does-not-exist-xyz123",
    );
    expect(status).toBe(404);
    expect(typeof body.error).toBe("string");
    assertExactKeys(body as Record<string, unknown>, ["error"]);
  });
});

// ============================================================
// Items — GET /api/v1/items/suggest
// ============================================================

describe("GET /api/v1/items/suggest", () => {
  it("returns 400 when q is missing", async () => {
    const { status } = await get("/api/v1/items/suggest");
    expect(status).toBe(400);
  });

  it("returns an array (possibly empty) for a valid query", async () => {
    const { status, body } = await json<unknown>(
      "/api/v1/items/suggest?q=welcome",
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns empty array for very short query (service-level guard)", async () => {
    const { status, body } = await json<unknown[]>("/api/v1/items/suggest?q=a");
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("each suggestion has exactly slug + name", async () => {
    const { body } = await json<Record<string, unknown>[]>(
      "/api/v1/items/suggest?q=welcome",
    );
    for (const s of body) {
      assertExactKeys(s, ["slug", "name"]);
      expect(typeof s.slug).toBe("string");
      expect(typeof s.name).toBe("string");
    }
  });

  it("/suggest does NOT match the :slug route", async () => {
    // Critical regression check: route order matters. If `/suggest` were
    // registered after `/:slug`, this would 404 (the slug "suggest" doesn't
    // exist) instead of returning a suggestion list.
    const { status, body } = await json<unknown[]>(
      "/api/v1/items/suggest?q=welcome",
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});
