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

import { timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { getConnInfo } from "hono/bun";
import { normalizeIp } from "@/utils/get-client-ip";

export interface InternalAuthConfig {
  secret: string;
  allowedIps: Set<string>;
}

// Well-known default values shipped in the template — refuse to boot with any
// of these so a forgotten `.env` can't silently expose /internal/* to anyone
// who has read the repo.
const FORBIDDEN_DEFAULT_SECRETS = new Set<string>([
  "change-me-in-prod",
  "change-me",
  "changeme",
  "secret",
  "password",
]);

function getDirectIp(c: Context): string {
  try {
    return normalizeIp(getConnInfo(c).remote.address ?? "unknown");
  } catch {
    return "unknown";
  }
}

/**
 * Resolve the effective caller IP.
 *
 * Trust `X-Forwarded-For` ONLY when the direct TCP peer is in the explicit
 * `INTERNAL_ALLOWED_IPS` set (i.e. a known reverse proxy). We intentionally
 * do NOT trust the header just because the direct peer is in an RFC1918
 * range — under Docker port publishing every public client arrives with a
 * private bridge-gateway source IP, which would let any unauthenticated
 * caller spoof a localhost source and walk straight past the allowlist.
 *
 * For all other direct peers (including private IPs that aren't on the
 * allowlist), use the direct connection IP as-is.
 */
function resolveCallerIp(c: Context, allowedIps: Set<string>): string {
  const directIp = getDirectIp(c);

  if (allowedIps.has(directIp)) {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) return normalizeIp(forwarded.split(",")[0]!.trim());
  }

  return directIp;
}

function secretsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function buildInternalAuthConfig(): InternalAuthConfig {
  const raw = process.env;

  const secret = raw.INTERNAL_API_SECRET || "";
  if (!secret) {
    throw new Error(
      "INTERNAL_API_SECRET environment variable is required for internal auth",
    );
  }
  if (FORBIDDEN_DEFAULT_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      `INTERNAL_API_SECRET is set to a well-known default value (${secret}). ` +
        "Generate a unique secret (e.g. `openssl rand -hex 32`) before booting.",
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

    // Layer 2: Shared secret validation (constant-time)
    const providedSecret = c.req.header("X-Internal-Secret");

    if (!providedSecret || !secretsEqual(providedSecret, cfg.secret)) {
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
