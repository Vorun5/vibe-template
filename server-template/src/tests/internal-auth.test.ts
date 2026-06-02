/**
 * Unit tests for internal-auth middleware.
 *
 * Tests two-layer authentication for /internal/* endpoints:
 *   1. IP whitelist validation
 *   2. Shared secret (X-Internal-Secret header) validation
 *
 * Both checks must pass for the request to succeed.
 */

import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import {
  createInternalAuth,
  type InternalAuthConfig,
} from "@/middleware/internal-auth";

// ---------- Helpers ----------

function makeConfig(
  overrides: Partial<InternalAuthConfig> = {},
): InternalAuthConfig {
  return {
    secret: "test-secret-12345",
    // In test environment, Hono.fetch() doesn't create real connections,
    // so getConnInfo returns "unknown" - we include it for testing
    allowedIps: new Set(["127.0.0.1", "::1", "192.168.1.100", "unknown"]),
    ...overrides,
  };
}

function createApp(cfg: InternalAuthConfig) {
  const app = new Hono();
  app.use("/internal/*", createInternalAuth(cfg));

  app.get("/internal/items/:slug/info", (c) =>
    c.json({ slug: c.req.param("slug"), name: "test" }),
  );
  app.post("/internal/items/:slug/touch", (c) =>
    c.json({ success: true }),
  );

  return app;
}

async function get(
  app: Hono,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "GET",
      headers,
    }),
  );
}

async function post(
  app: Hono,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers,
    }),
  );
}

// ---------- Tests ----------

describe("Internal Auth — IP Whitelist", () => {
  it("allows requests from whitelisted IPs", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res = await get(
      app,
      "/internal/items/test/info",
      { "X-Internal-Secret": "test-secret-12345" },
    );

    expect(res.status).toBe(200);
  });

  it("blocks requests from non-whitelisted IPs", async () => {
    const cfg = makeConfig({ allowedIps: new Set(["192.168.1.100"]) });
    const app = createApp(cfg);

    const res = await get(
      app,
      "/internal/items/test/info",
      { "X-Internal-Secret": "test-secret-12345" },
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("IP not authorized");
  });
});

describe("Internal Auth — Shared Secret", () => {
  it("allows requests with correct secret", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res = await get(
      app,
      "/internal/items/test/info",
      { "X-Internal-Secret": "test-secret-12345" },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("test");
  });

  it("blocks requests without secret header", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res = await get(app, "/internal/items/test/info");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(body.message).toContain("X-Internal-Secret");
  });

  it("blocks requests with incorrect secret", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res = await get(
      app,
      "/internal/items/test/info",
      { "X-Internal-Secret": "wrong-secret" },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("blocks requests with empty secret", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res = await get(
      app,
      "/internal/items/test/info",
      { "X-Internal-Secret": "" },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});

describe("Internal Auth — Both Layers", () => {
  it("requires both IP whitelist AND correct secret", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res1 = await get(
      app,
      "/internal/items/test/info",
      { "X-Internal-Secret": "wrong-secret" },
    );
    expect(res1.status).toBe(401);

    const cfg2 = makeConfig({ allowedIps: new Set(["192.168.1.100"]) });
    const app2 = createApp(cfg2);
    const res2 = await get(
      app2,
      "/internal/items/test/info",
      { "X-Internal-Secret": "test-secret-12345" },
    );
    expect(res2.status).toBe(403);
  });

  it("allows POST requests with both checks passing", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res = await post(
      app,
      "/internal/items/test/touch",
      { "X-Internal-Secret": "test-secret-12345" },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("blocks POST requests without secret", async () => {
    const cfg = makeConfig();
    const app = createApp(cfg);

    const res = await post(app, "/internal/items/test/touch");

    expect(res.status).toBe(401);
  });
});
