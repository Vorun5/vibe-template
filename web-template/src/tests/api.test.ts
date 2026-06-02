/**
 * Tests for src/lib/api.ts — the typed API client.
 *
 * Covers:
 *   - Error class shape (`name` field is what middleware switches on).
 *   - fetchJson translates HTTP status codes to typed errors.
 *   - clientIp forwarding via X-Forwarded-For.
 *   - getClientIp delegates to security.resolveClientIp.
 *   - URL construction for getItems / getItem / itemSuggest.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  getClientIp,
  getItem,
  getItems,
  itemSuggest,
} from "@/lib/api";

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(handler);
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================
// Error classes
// ============================================================

describe("error classes", () => {
  it("RateLimitError exposes retryAfter and name", () => {
    const e = new RateLimitError(120);
    expect(e.name).toBe("RateLimitError");
    expect(e.retryAfter).toBe(120);
    expect(e).toBeInstanceOf(Error);
  });

  it("RateLimitError defaults retryAfter to 60", () => {
    expect(new RateLimitError().retryAfter).toBe(60);
  });

  it("ForbiddenError has the right name", () => {
    expect(new ForbiddenError().name).toBe("ForbiddenError");
  });

  it("NotFoundError has the right name", () => {
    expect(new NotFoundError().name).toBe("NotFoundError");
  });
});

// ============================================================
// fetchJson behaviour (via getItems / getItem)
// ============================================================

describe("fetchJson — HTTP status translation", () => {
  it("throws RateLimitError on 429 and reads Retry-After", async () => {
    mockFetch(() =>
      new Response("", {
        status: 429,
        headers: { "Retry-After": "120" },
      }),
    );
    try {
      await getItems({});
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      if (e instanceof RateLimitError) expect(e.retryAfter).toBe(120);
    }
  });

  it("RateLimitError defaults retryAfter to 60 when header missing", async () => {
    mockFetch(() => new Response("", { status: 429 }));
    try {
      await getItems({});
      expect.fail("should have thrown");
    } catch (e) {
      if (e instanceof RateLimitError) expect(e.retryAfter).toBe(60);
    }
  });

  it("throws ForbiddenError on 401", async () => {
    mockFetch(() => new Response("", { status: 401 }));
    await expect(getItems({})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError on 403", async () => {
    mockFetch(() => new Response("", { status: 403 }));
    await expect(getItems({})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError on 404", async () => {
    mockFetch(() => new Response("", { status: 404 }));
    await expect(getItem("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws generic Error on other 5xx", async () => {
    mockFetch(() => new Response("oops", { status: 503, statusText: "Service Unavailable" }));
    await expect(getItems({})).rejects.toThrow(/503/);
  });

  it("translates network failure into a Network error", async () => {
    mockFetch(() => {
      throw new TypeError("network down");
    });
    await expect(getItems({})).rejects.toThrow(/Network error/);
  });

  it("returns parsed JSON on 200", async () => {
    mockFetch(() =>
      Response.json({
        list: [{ slug: "a", name: "A", views: 1 }],
        total: 1,
        page: 0,
        limit: 20,
        totalPages: 1,
      }),
    );
    const result = await getItems({});
    expect(result.list[0].slug).toBe("a");
    expect(result.total).toBe(1);
  });
});

// ============================================================
// clientIp forwarding
// ============================================================

describe("fetchJson — X-Forwarded-For forwarding", () => {
  it("sets X-Forwarded-For when clientIp is provided", async () => {
    const spy = mockFetch(() => Response.json({ list: [], total: 0, page: 0, limit: 0, totalPages: 0 }));
    await getItems({}, "9.9.9.9");
    const callInit = spy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(callInit.headers);
    expect(headers.get("x-forwarded-for")).toBe("9.9.9.9");
  });

  it("does NOT set X-Forwarded-For when clientIp is omitted", async () => {
    const spy = mockFetch(() => Response.json({ list: [], total: 0, page: 0, limit: 0, totalPages: 0 }));
    await getItems({});
    const callInit = spy.mock.calls[0][1] as RequestInit | undefined;
    const headers = new Headers(callInit?.headers ?? {});
    expect(headers.get("x-forwarded-for")).toBeNull();
  });
});

// ============================================================
// URL construction
// ============================================================

describe("URL construction", () => {
  it("getItems(empty) hits /api/v1/items with no query string", async () => {
    const spy = mockFetch(() => Response.json({ list: [], total: 0, page: 0, limit: 0, totalPages: 0 }));
    await getItems({});
    const url = String(spy.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/v1\/items$/);
  });

  it("getItems({page,limit}) serializes into the query string", async () => {
    const spy = mockFetch(() => Response.json({ list: [], total: 0, page: 0, limit: 0, totalPages: 0 }));
    await getItems({ page: 3, limit: 50 });
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("page=3");
    expect(url).toContain("limit=50");
  });

  it("getItem(slug) hits /api/v1/items/<slug>", async () => {
    const spy = mockFetch(() =>
      Response.json({ slug: "x", name: "X", views: 0, createdAt: "2026-01-01T00:00:00.000Z" }),
    );
    await getItem("hello-world");
    const url = String(spy.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/v1\/items\/hello-world$/);
  });

  it("itemSuggest('') short-circuits without a fetch call", async () => {
    const spy = mockFetch(() => Response.json([]));
    const result = await itemSuggest("");
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("itemSuggest('a') short-circuits (below MIN length)", async () => {
    const spy = mockFetch(() => Response.json([]));
    const result = await itemSuggest("a");
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("itemSuggest('ab') hits /api/v1/items/suggest?q=ab", async () => {
    const spy = mockFetch(() => Response.json([{ slug: "a", name: "A" }]));
    await itemSuggest("hello");
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("/api/v1/items/suggest");
    expect(url).toContain("q=hello");
  });

  it("itemSuggest URL-encodes special characters", async () => {
    const spy = mockFetch(() => Response.json([]));
    await itemSuggest("a b&c");
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("q=a+b%26c");
  });
});

// ============================================================
// getClientIp (Astro-context helper)
// ============================================================

describe("getClientIp", () => {
  it("returns the direct address when no proxy is involved", () => {
    const astro = {
      clientAddress: "8.8.8.8",
      request: new Request("http://localhost/"),
    };
    expect(getClientIp(astro)).toBe("8.8.8.8");
  });

  it("honours X-Forwarded-For when direct address is loopback", () => {
    const astro = {
      clientAddress: "127.0.0.1",
      request: new Request("http://localhost/", {
        headers: { "x-forwarded-for": "5.6.7.8, 9.9.9.9" },
      }),
    };
    expect(getClientIp(astro)).toBe("5.6.7.8");
  });

  it("ignores X-Forwarded-For from an untrusted public IP", () => {
    const astro = {
      clientAddress: "8.8.8.8",
      request: new Request("http://localhost/", {
        headers: { "x-forwarded-for": "127.0.0.1" },
      }),
    };
    expect(getClientIp(astro)).toBe("8.8.8.8");
  });
});
