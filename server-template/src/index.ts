import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "@/config/env";
import itemsRoutes from "@/routes/items";
import internalRoutes from "@/routes/internal";
import {
  loadFromDisk as loadBlocklistFromDisk,
  startTtlCleanup as startBlocklistTtlCleanup,
} from "@/services/blocklist.service";
import { warmupItemsCache } from "@/services/item.service";
import {
  buildRateLimitConfig,
  createRateLimiter,
} from "@/middleware/rate-limit";
import {
  buildInternalAuthConfig,
  createInternalAuth,
} from "@/middleware/internal-auth";
import { createHttpLogger } from "@/middleware/http-logger";
import { createIpBlocklist } from "@/middleware/ip-blocklist";
import { createMetricsMiddleware } from "@/middleware/metrics";
import { registry } from "@/metrics";
import { logger } from "@/utils/loki-logger";

const app = new Hono();

// Middleware
app.use("*", createMetricsMiddleware());
app.use("*", createHttpLogger());
app.use("*", createIpBlocklist());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use("*", createRateLimiter(buildRateLimitConfig()));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Prometheus metrics endpoint
app.get("/metrics", async (c) => {
  const metrics = await registry.metrics();
  return c.text(metrics, 200, {
    "Content-Type": registry.contentType,
  });
});

// Internal routes — protected by IP whitelist + shared secret
app.use("/internal/*", createInternalAuth(buildInternalAuthConfig()));
app.route("/internal", internalRoutes);

// API routes
app.route("/api/v1/items", itemsRoutes);

// Load IP blocklist from disk BEFORE serving (the middleware reads it on
// every request, so first requests must not slip past unchecked).
await loadBlocklistFromDisk();
startBlocklistTtlCleanup();

logger.info("server started", { port: env.PORT });

// Warm-up caches — fire-and-forget so we don't block the first request.
warmupItemsCache().catch(() => {});

export default {
  port: env.PORT,
  fetch: app.fetch,
};
