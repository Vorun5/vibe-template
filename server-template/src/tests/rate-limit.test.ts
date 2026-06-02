/**
 * Unit tests for the rate limiter middleware.
 *
 * Creates a minimal Hono app with rate limiting enabled and tests:
 *   - Bucket routing (api, search, covers)
 *   - Skipped paths (internal, health, metrics, favicon)
 *   - Sliding window enforcement
 *   - Progressive bans
 *   - Whitelist bypass
 *   - Rate limit headers
 */

import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import {
  createRateLimiter,
  type RateLimitConfig,
} from "@/middleware/rate-limit";

// ---------- Helpers ----------

function makeConfig(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
  return {
    enabled: true,
    windowMs: 60_000,
    maxApi: 5,
    maxSearch: 3,
    maxCovers: 10,
    banThreshold: 3,
    banDurationMs: 600_000,
    trustedProxies: new Set(["127.0.0.1", "::1"]),
    whitelist: new Set<string>(),
    ...overrides,
  };
}

function createApp(cfg: RateLimitConfig) {
  const app = new Hono();
  app.use("*", createRateLimiter(cfg));

  app.get("/api/v1/items", (c) => c.json({ ok: true }));
  app.get("/api/v1/items/:slug", (c) => c.json({ ok: true }));
  app.get("/api/v1/search", (c) => c.json({ ok: true }));
  app.get("/api/v1/search/suggest", (c) => c.json({ ok: true }));
  app.get("/covers/:file", (c) => c.json({ ok: true }));
  app.get("/internal/items/:slug/info", (c) => c.json({ ok: true }));
  app.post("/internal/items/:slug/touch", (c) => c.json({ ok: true }));
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/metrics", (c) => c.text("metrics"));
  app.get("/favicon.ico", (c) => c.body(null, 204));
  return app;
}

async function get(app: Hono, path: string): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, { method: "GET" }));
}

async function post(app: Hono, path: string): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, { method: "POST" }));
}

// ---------- Tests ----------

describe("Rate limiter — skipped paths", () => {
  it("skips /internal/* endpoints", async () => {
    const cfg = makeConfig({ maxApi: 1 });
    const app = createApp(cfg);

    await get(app, "/api/v1/items");
    const blocked = await get(app, "/api/v1/items");
    expect(blocked.status).toBe(429);

    for (let i = 0; i < 20; i++) {
      const res = await get(app, "/internal/items/test/info");
      expect(res.status).toBe(200);
    }
  });

  it("skips /internal POST endpoints", async () => {
    const cfg = makeConfig({ maxApi: 1 });
    const app = createApp(cfg);

    await get(app, "/api/v1/items");
    const blocked = await get(app, "/api/v1/items");
    expect(blocked.status).toBe(429);

    const res = await post(app, "/internal/items/test/touch");
    expect(res.status).toBe(200);
  });

  it("skips /health", async () => {
    const cfg = makeConfig({ maxApi: 1 });
    const app = createApp(cfg);

    await get(app, "/api/v1/items");
    await get(app, "/api/v1/items");

    const res = await get(app, "/health");
    expect(res.status).toBe(200);
  });

  it("skips /metrics", async () => {
    const cfg = makeConfig({ maxApi: 1 });
    const app = createApp(cfg);

    await get(app, "/api/v1/items");
    await get(app, "/api/v1/items");

    const res = await get(app, "/metrics");
    expect(res.status).toBe(200);
  });

  it("skips /favicon.ico", async () => {
    const cfg = makeConfig({ maxApi: 1 });
    const app = createApp(cfg);

    await get(app, "/api/v1/items");
    await get(app, "/api/v1/items");

    const res = await get(app, "/favicon.ico");
    expect(res.status).toBe(204);
  });
});

describe("Rate limiter — bucket isolation", () => {
  it("search bucket is independent from api bucket", async () => {
    const cfg = makeConfig({ maxApi: 3, maxSearch: 2 });
    const app = createApp(cfg);

    await get(app, "/api/v1/search?q=test");
    await get(app, "/api/v1/search?q=test");
    const searchBlocked = await get(app, "/api/v1/search?q=test");
    expect(searchBlocked.status).toBe(429);

    const apiOk = await get(app, "/api/v1/items");
    expect(apiOk.status).toBe(200);
  });

  it("covers bucket is independent from api bucket", async () => {
    const cfg = makeConfig({ maxApi: 2, maxCovers: 3 });
    const app = createApp(cfg);

    await get(app, "/api/v1/items");
    await get(app, "/api/v1/items");
    const apiBlocked = await get(app, "/api/v1/items");
    expect(apiBlocked.status).toBe(429);

    const coversOk = await get(app, "/covers/test.jpg");
    expect(coversOk.status).toBe(200);
  });

  it("/api/v1/search/suggest uses search bucket", async () => {
    const cfg = makeConfig({ maxSearch: 2 });
    const app = createApp(cfg);

    await get(app, "/api/v1/search/suggest?q=a");
    await get(app, "/api/v1/search/suggest?q=b");
    const res = await get(app, "/api/v1/search/suggest?q=c");
    expect(res.status).toBe(429);
  });
});

describe("Rate limiter — sliding window", () => {
  it("allows exactly maxApi requests in a window", async () => {
    const cfg = makeConfig({ maxApi: 5 });
    const app = createApp(cfg);

    for (let i = 0; i < 5; i++) {
      const res = await get(app, "/api/v1/items");
      expect(res.status).toBe(200);
    }

    const blocked = await get(app, "/api/v1/items");
    expect(blocked.status).toBe(429);
  });

  it("allows exactly maxSearch requests in a window", async () => {
    const cfg = makeConfig({ maxSearch: 3 });
    const app = createApp(cfg);

    for (let i = 0; i < 3; i++) {
      const res = await get(app, "/api/v1/search?q=test");
      expect(res.status).toBe(200);
    }

    const blocked = await get(app, "/api/v1/search?q=test");
    expect(blocked.status).toBe(429);
  });

  it("allows exactly maxCovers requests in a window", async () => {
    const cfg = makeConfig({ maxCovers: 4 });
    const app = createApp(cfg);

    for (let i = 0; i < 4; i++) {
      const res = await get(app, `/covers/file-${i}.jpg`);
      expect(res.status).toBe(200);
    }

    const blocked = await get(app, "/covers/next.jpg");
    expect(blocked.status).toBe(429);
  });
});

describe("Rate limiter — response headers", () => {
  it("sets X-RateLimit-* headers on successful requests", async () => {
    const cfg = makeConfig({ maxApi: 10 });
    const app = createApp(cfg);

    const res = await get(app, "/api/v1/items");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("remaining decreases with each request", async () => {
    const cfg = makeConfig({ maxApi: 5 });
    const app = createApp(cfg);

    const r1 = await get(app, "/api/v1/items");
    expect(r1.headers.get("X-RateLimit-Remaining")).toBe("4");

    const r2 = await get(app, "/api/v1/items");
    expect(r2.headers.get("X-RateLimit-Remaining")).toBe("3");

    const r3 = await get(app, "/api/v1/items");
    expect(r3.headers.get("X-RateLimit-Remaining")).toBe("2");
  });

  it("429 response includes Retry-After header", async () => {
    const cfg = makeConfig({ maxApi: 1 });
    const app = createApp(cfg);

    await get(app, "/api/v1/items");
    const blocked = await get(app, "/api/v1/items");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not set headers on skipped paths", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res = await get(app, "/health");
    expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
  });
});

describe("Rate limiter — progressive bans", () => {
  it("bans IP after banThreshold violations", async () => {
    const cfg = makeConfig({ maxApi: 1, banThreshold: 2, banDurationMs: 60_000 });
    const app = createApp(cfg);

    const ok = await get(app, "/api/v1/items");
    expect(ok.status).toBe(200);

    const v1 = await get(app, "/api/v1/items");
    expect(v1.status).toBe(429);
    expect(v1.headers.get("X-RateLimit-Blocked")).toBeNull();

    const v2 = await get(app, "/api/v1/items");
    expect(v2.status).toBe(429);

    const bannedSearch = await get(app, "/api/v1/search?q=test");
    expect(bannedSearch.status).toBe(429);
    expect(bannedSearch.headers.get("X-RateLimit-Blocked")).toBe("true");

    const bannedCovers = await get(app, "/covers/test.jpg");
    expect(bannedCovers.status).toBe(429);
    expect(bannedCovers.headers.get("X-RateLimit-Blocked")).toBe("true");
  });

  it("banned IP still passes through skipped paths", async () => {
    const cfg = makeConfig({ maxApi: 1, banThreshold: 1 });
    const app = createApp(cfg);

    await get(app, "/api/v1/items");
    await get(app, "/api/v1/items");

    const banned = await get(app, "/api/v1/items");
    expect(banned.status).toBe(429);

    const internal = await get(app, "/internal/items/test/info");
    expect(internal.status).toBe(200);

    const health = await get(app, "/health");
    expect(health.status).toBe(200);
  });
});

describe("Rate limiter — whitelist", () => {
  it("whitelisted IP bypasses all limits", async () => {
    const cfg = makeConfig({ maxApi: 1, whitelist: new Set(["unknown"]) });
    const app = createApp(cfg);

    for (let i = 0; i < 20; i++) {
      const res = await get(app, "/api/v1/items");
      expect(res.status).toBe(200);
    }
  });
});

describe("Rate limiter — disabled", () => {
  it("passes all requests when disabled", async () => {
    const cfg = makeConfig({ enabled: false, maxApi: 1 });
    const app = createApp(cfg);

    for (let i = 0; i < 20; i++) {
      const res = await get(app, "/api/v1/items");
      expect(res.status).toBe(200);
    }
  });
});
