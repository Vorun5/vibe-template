/**
 * Authentication middleware for /internal/* endpoints.
 *
 * Two-layer security:
 *   1. IP Whitelist — Only allow requests from specific service IPs
 *   2. Shared Secret — Validate X-Internal-Secret header
 *
 * Both checks must pass for the request to proceed.
 *
 * ENV configuration:
 *   INTERNAL_API_SECRET       — Required. Shared secret for service-to-service auth
 *   INTERNAL_ALLOWED_IPS      — Comma-separated IPs allowed to call /internal/*
 *                                (default: "127.0.0.1,::1,::ffff:127.0.0.1")
 */

import type { Context, Next } from "hono";
import { getConnInfo } from "hono/bun";
import { normalizeIp } from "@/utils/get-client-ip";

export interface InternalAuthConfig {
  secret: string;
  allowedIps: Set<string>;
}

function getDirectIp(c: Context): string {
  try {
    return normalizeIp(getConnInfo(c).remote.address ?? "unknown");
  } catch {
    return "unknown";
  }
}

function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, "");
  return (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    (clean.startsWith("172.") &&
      (() => {
        const second = parseInt(clean.split(".")[1] ?? "0", 10);
        return second >= 16 && second <= 31;
      })())
  );
}

/**
 * Resolve the effective caller IP.
 *
 * Direct connection from allowed/private IP → trusted, check X-Forwarded-For
 * so that requests routed through a reverse proxy are authenticated by the
 * real upstream IP.
 * Direct connection from unknown public IP → use it as-is (no proxy involved).
 */
function resolveCallerIp(c: Context, allowedIps: Set<string>): string {
  const directIp = getDirectIp(c);

  if (allowedIps.has(directIp) || isPrivateIp(directIp)) {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) return normalizeIp(forwarded.split(",")[0]!.trim());
  }

  return directIp;
}

export function buildInternalAuthConfig(): InternalAuthConfig {
  const raw = process.env;

  const secret = raw.INTERNAL_API_SECRET || "";
  if (!secret) {
    throw new Error(
      "INTERNAL_API_SECRET environment variable is required for internal auth",
    );
  }

  const allowedIpsRaw = raw.INTERNAL_ALLOWED_IPS;
  const allowedIps = new Set<string>(
    allowedIpsRaw !== undefined
      ? allowedIpsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : ["127.0.0.1", "::1", "::ffff:127.0.0.1"],
  );

  return {
    secret,
    allowedIps,
  };
}

export function createInternalAuth(cfg: InternalAuthConfig) {
  return async function internalAuthMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | void> {
    // Layer 1: IP whitelist check
    const clientIp = resolveCallerIp(c, cfg.allowedIps);

    if (!cfg.allowedIps.has(clientIp)) {
      return c.json(
        {
          error: "Forbidden",
          message: "IP not authorized for internal endpoints",
        },
        403,
      );
    }

    // Layer 2: Shared secret validation
    const providedSecret = c.req.header("X-Internal-Secret");

    if (!providedSecret || providedSecret !== cfg.secret) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Invalid or missing X-Internal-Secret header",
        },
        401,
      );
    }

    // Both checks passed
    return next();
  };
}
