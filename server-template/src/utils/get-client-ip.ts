import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

/**
 * Strip the IPv4-mapped IPv6 prefix (`::ffff:`) so that IPv4 clients reaching
 * Bun's dual-stack socket are normalized to plain dotted-quad form. Without
 * this, env-configured allowlists/blocklists ("10.0.1.12") never match the
 * runtime IP ("::ffff:10.0.1.12").
 */
export function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, "");
}

function isPrivateIp(ip: string): boolean {
  const clean = normalizeIp(ip);
  return (
    clean.startsWith("10.") ||
    clean.startsWith("172.16.") || clean.startsWith("172.17.") ||
    clean.startsWith("172.18.") || clean.startsWith("172.19.") ||
    clean.startsWith("172.20.") || clean.startsWith("172.21.") ||
    clean.startsWith("172.22.") || clean.startsWith("172.23.") ||
    clean.startsWith("172.24.") || clean.startsWith("172.25.") ||
    clean.startsWith("172.26.") || clean.startsWith("172.27.") ||
    clean.startsWith("172.28.") || clean.startsWith("172.29.") ||
    clean.startsWith("172.30.") || clean.startsWith("172.31.") ||
    clean.startsWith("192.168.") ||
    clean === "127.0.0.1" || clean === "::1"
  );
}

export function getClientIp(c: Context, trustedProxies: Set<string>): string {
  let connIp: string;
  try {
    connIp = getConnInfo(c).remote.address ?? "";
  } catch {
    connIp = "";
  }

  if (connIp && (trustedProxies.has(connIp) || isPrivateIp(connIp))) {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) return normalizeIp(forwarded.split(",")[0]!.trim());
    const realIp = c.req.header("x-real-ip");
    if (realIp) return normalizeIp(realIp.trim());
  }

  return normalizeIp(connIp) || "unknown";
}
