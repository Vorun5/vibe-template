import type { Context, Next } from "hono";
import { getClientIp } from "@/utils/get-client-ip";
import { isBlocked } from "@/services/blocklist.service";

const trustedProxies = new Set<string>(
  (process.env.RATE_LIMIT_TRUSTED_PROXIES ?? "127.0.0.1,::1,::ffff:127.0.0.1")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function createIpBlocklist() {
  return async function ipBlocklistMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | void> {
    const ip = getClientIp(c, trustedProxies);
    if (isBlocked(ip)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    return next();
  };
}
