import type { Context, Next } from "hono";
import { httpRequestsTotal, httpRequestDuration } from "@/metrics";

/**
 * Normalize dynamic path segments so Prometheus labels stay low-cardinality.
 *
 * TODO: adapt these regexes to your routes. If you skip this step, every
 * unique slug/id becomes its own `path` label value and the histogram
 * will explode Prometheus memory.
 *
 * Example template rules (matches the demo /api/v1/items resource):
 *   /api/v1/items/abc        → /api/v1/items/:slug
 *   /internal/items/abc/info → /internal/items/:slug/info
 */
function normalizePath(path: string): string {
  return path
    .replace(/^\/api\/v1\/items\/([^/]+)$/, "/api/v1/items/:slug")
    .replace(/^\/internal\/items\/([^/]+)\/(.+)$/, "/internal/items/:slug/$2");
}

export function createMetricsMiddleware() {
  return async function metricsMiddleware(
    c: Context,
    next: Next,
  ): Promise<void> {
    // Skip metrics for the /metrics endpoint itself
    if (c.req.path === "/metrics") {
      await next();
      return;
    }

    const start = performance.now();
    await next();

    const duration = (performance.now() - start) / 1000;
    const method = c.req.method;
    const path = normalizePath(c.req.path);
    const status = String(c.res.status);

    httpRequestsTotal.inc({ method, path, status });
    httpRequestDuration.observe({ method, path, status }, duration);
  };
}
