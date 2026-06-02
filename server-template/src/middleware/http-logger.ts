import type { Context, Next } from "hono";
import { logger } from "@/utils/loki-logger";
import { getClientIp } from "@/utils/get-client-ip";

const trustedProxies = new Set<string>(
  (process.env.RATE_LIMIT_TRUSTED_PROXIES ?? "127.0.0.1,::1,::ffff:127.0.0.1")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function createHttpLogger() {
  return async function httpLoggerMiddleware(
    c: Context,
    next: Next,
  ): Promise<void> {
    if (c.req.path === "/metrics" || c.req.path === "/health") {
      await next();
      return;
    }

    const start = performance.now();
    await next();

    const ms = Math.round(performance.now() - start);
    const status = c.res.status;
    const method = c.req.method;
    const path = c.req.path;
    const ip = getClientIp(c, trustedProxies);
    const ua = c.req.header("user-agent") ?? "";

    const extra = { method, path, status, ms, ip, ua };

    if (status >= 500) {
      logger.error(`${method} ${path}`, extra);
    } else if (status >= 400) {
      logger.warn(`${method} ${path}`, extra);
    } else {
      logger.info(`${method} ${path}`, extra);
    }
  };
}
