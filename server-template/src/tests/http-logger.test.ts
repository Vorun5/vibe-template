/**
 * Unit tests for createHttpLogger.
 *
 * The middleware writes JSON to console.log/warn/error and (when LOKI_URL
 * is set) fires a fetch to Loki. Tests capture stdout and assert:
 *   - /health and /metrics are skipped (no log line)
 *   - 2xx logs at info, 4xx at warn, 5xx at error
 *   - log lines are pure JSON (no `level=… msg=…` prefix) — this is the
 *     load-bearing convention that LogQL `| json` relies on.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { createHttpLogger } from "@/middleware/http-logger";

interface CapturedLine {
  level: "info" | "warn" | "error";
  text: string;
}

let captured: CapturedLine[];
let originalLog: typeof console.log;
let originalWarn: typeof console.warn;
let originalError: typeof console.error;

beforeEach(() => {
  captured = [];
  originalLog = console.log;
  originalWarn = console.warn;
  originalError = console.error;
  console.log = ((msg: string) =>
    captured.push({ level: "info", text: String(msg) })) as typeof console.log;
  console.warn = ((msg: string) =>
    captured.push({ level: "warn", text: String(msg) })) as typeof console.warn;
  console.error = ((msg: string) =>
    captured.push({ level: "error", text: String(msg) })) as typeof console.error;
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});

function createApp() {
  const app = new Hono();
  app.use("*", createHttpLogger());
  app.get("/api/v1/items", (c) => c.json({ ok: true }));
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/metrics", (c) => c.text("metrics-text"));
  app.get("/forbidden", (c) => c.json({ error: "no" }, 403));
  app.get("/boom", (c) => c.json({ error: "server" }, 500));
  return app;
}

async function get(app: Hono, path: string): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, { method: "GET" }));
}

describe("http-logger — skip paths", () => {
  it("does not log /health", async () => {
    await get(createApp(), "/health");
    expect(captured).toHaveLength(0);
  });

  it("does not log /metrics", async () => {
    await get(createApp(), "/metrics");
    expect(captured).toHaveLength(0);
  });
});

describe("http-logger — log levels by status", () => {
  it("emits info for 2xx", async () => {
    await get(createApp(), "/api/v1/items");
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("info");
  });

  it("emits warn for 4xx", async () => {
    await get(createApp(), "/forbidden");
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("warn");
  });

  it("emits error for 5xx", async () => {
    await get(createApp(), "/boom");
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("error");
  });
});

describe("http-logger — pure JSON line shape", () => {
  it("line is parseable JSON (no level=/msg= prefix)", async () => {
    await get(createApp(), "/api/v1/items");
    const line = captured[0].text;
    // Must NOT start with the legacy `level=…` prefix that breaks `| json`.
    expect(line.startsWith("level=")).toBe(false);
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("info");
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/api/v1/items");
    expect(parsed.status).toBe(200);
    expect(typeof parsed.ms).toBe("number");
    expect(typeof parsed.ip).toBe("string");
    expect(typeof parsed.ua).toBe("string");
  });

  it("preserves user-agent", async () => {
    const app = createApp();
    await app.fetch(
      new Request("http://localhost/api/v1/items", {
        headers: { "user-agent": "TestAgent/1.0" },
      }),
    );
    const parsed = JSON.parse(captured[0].text);
    expect(parsed.ua).toBe("TestAgent/1.0");
  });
});
