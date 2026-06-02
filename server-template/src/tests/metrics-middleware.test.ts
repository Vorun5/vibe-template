/**
 * Unit tests for createMetricsMiddleware — verifies that:
 *   - The /metrics endpoint itself is skipped (no observation recorded).
 *   - Dynamic path segments get normalized to :slug so Prometheus
 *     cardinality stays low.
 *   - The middleware records httpRequestsTotal and httpRequestDuration
 *     with the right labels.
 */

import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { createMetricsMiddleware } from "@/middleware/metrics";
import { registry, httpRequestsTotal } from "@/metrics";

async function get(app: Hono, path: string): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, { method: "GET" }));
}

function getCounterValue(
  metric: typeof httpRequestsTotal,
  labels: { method: string; path: string; status: string },
): number {
  const json = (metric as unknown as {
    hashMap: Record<string, { value: number; labels: Record<string, string> }>;
  }).hashMap;
  for (const key of Object.keys(json)) {
    const entry = json[key];
    if (
      entry.labels.method === labels.method &&
      entry.labels.path === labels.path &&
      entry.labels.status === labels.status
    ) {
      return entry.value;
    }
  }
  return 0;
}

function createApp() {
  const app = new Hono();
  app.use("*", createMetricsMiddleware());
  app.get("/api/v1/items", (c) => c.json({ ok: true }));
  app.get("/api/v1/items/:slug", (c) => c.json({ ok: true }));
  app.get("/internal/items/:slug/info", (c) => c.json({ ok: true }));
  app.get("/metrics", (c) => c.text("metrics-text"));
  app.get("/health", (c) => c.json({ status: "ok" }));
  return app;
}

describe("metrics middleware — path normalization", () => {
  it("folds /api/v1/items/<slug> to /api/v1/items/:slug", async () => {
    const app = createApp();
    await get(app, "/api/v1/items/some-particular-slug");
    const value = getCounterValue(httpRequestsTotal, {
      method: "GET",
      path: "/api/v1/items/:slug",
      status: "200",
    });
    expect(value).toBeGreaterThanOrEqual(1);
  });

  it("folds /internal/items/<slug>/info to /internal/items/:slug/info", async () => {
    const app = createApp();
    await get(app, "/internal/items/abc-xyz/info");
    const value = getCounterValue(httpRequestsTotal, {
      method: "GET",
      path: "/internal/items/:slug/info",
      status: "200",
    });
    expect(value).toBeGreaterThanOrEqual(1);
  });

  it("does not record metrics for /metrics endpoint itself", async () => {
    const app = createApp();
    const before = getCounterValue(httpRequestsTotal, {
      method: "GET",
      path: "/metrics",
      status: "200",
    });
    await get(app, "/metrics");
    const after = getCounterValue(httpRequestsTotal, {
      method: "GET",
      path: "/metrics",
      status: "200",
    });
    expect(after).toBe(before);
  });

  it("records /health (NOT in skip list)", async () => {
    const app = createApp();
    await get(app, "/health");
    const value = getCounterValue(httpRequestsTotal, {
      method: "GET",
      path: "/health",
      status: "200",
    });
    expect(value).toBeGreaterThanOrEqual(1);
  });
});

describe("metrics middleware — registry", () => {
  it("registry.metrics() returns Prometheus text exposition", async () => {
    const text = await registry.metrics();
    expect(text).toContain("# HELP http_requests_total");
    expect(text).toContain("# TYPE http_requests_total counter");
    expect(text).toContain("# TYPE http_request_duration_seconds histogram");
    expect(text).toContain("# TYPE db_connections_active gauge");
  });
});
