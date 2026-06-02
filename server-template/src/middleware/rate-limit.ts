/**
 * In-memory rate limiter with sliding window + progressive IP bans.
 *
 * Buckets:
 *   "search"  — /api/v1/search*               (DB-intensive, strictest)
 *   "covers"  — /covers/*                     (static images, lenient)
 *   "api"     — all other /api/v1/* endpoints
 *
 * Skipped paths (no rate limiting):
 *   /internal/*  — service-to-service traffic, protected by internal-auth
 *   /health      — health checks
 *   /metrics     — Prometheus scraping
 *   /favicon.ico — browser auto-request
 *
 * ENV configuration:
 *   RATE_LIMIT_ENABLED          — "true" to enable (default: false)
 *   RATE_LIMIT_WINDOW_MS        — sliding window in ms (default: 60000)
 *   RATE_LIMIT_MAX_API          — API req/window (default: 120)
 *   RATE_LIMIT_MAX_SEARCH       — search req/window (default: 30)
 *   RATE_LIMIT_MAX_COVERS       — cover image req/window (default: 600)
 *   RATE_LIMIT_BAN_THRESHOLD    — violations before temp ban (default: 5)
 *   RATE_LIMIT_BAN_DURATION_MS  — ban duration in ms (default: 600000 = 10 min)
 *   RATE_LIMIT_TRUSTED_PROXIES  — comma-separated IPs trusted to forward X-Forwarded-For
 *                                  (default: "127.0.0.1,::1,::ffff:127.0.0.1")
 *   RATE_LIMIT_WHITELIST        — comma-separated IPs to skip rate limiting entirely (default: "")
 */

import type { Context, Next } from "hono";
import { getClientIp } from "@/utils/get-client-ip";

// ---------- Types ----------

type Bucket = "search" | "covers" | "api";

interface WindowEntry {
  count: number;
  windowStart: number;
}

interface BanEntry {
  bannedUntil: number;
  violations: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxApi: number;
  maxSearch: number;
  maxCovers: number;
  banThreshold: number;
  banDurationMs: number;
  trustedProxies: Set<string>;
  whitelist: Set<string>;
}

// ---------- Helpers ----------

/** Paths that bypass rate limiting entirely. */
const SKIP_PREFIXES = [
  "/internal/",
  "/health",
  "/metrics",
  "/favicon.ico",
];

function shouldSkip(path: string): boolean {
  return SKIP_PREFIXES.some((p) => path.startsWith(p));
}

function getBucket(path: string): Bucket {
  if (path.startsWith("/api/v1/search")) return "search";
  if (path.startsWith("/covers/")) return "covers";
  return "api";
}

function getLimit(bucket: Bucket, cfg: RateLimitConfig): number {
  if (bucket === "search") return cfg.maxSearch;
  if (bucket === "covers") return cfg.maxCovers;
  return cfg.maxApi;
}

// ---------- Middleware factory ----------

export function createRateLimiter(cfg: RateLimitConfig) {
  // Per-instance stores — each createRateLimiter call gets its own state
  const windowStore = new Map<string, WindowEntry>();
  const banStore = new Map<string, BanEntry>();

  function recordViolation(ip: string): boolean {
    const existing = banStore.get(ip);
    const violations = (existing?.violations ?? 0) + 1;

    if (violations >= cfg.banThreshold) {
      banStore.set(ip, {
        bannedUntil: Date.now() + cfg.banDurationMs,
        violations,
      });
      return true;
    }

    banStore.set(ip, {
      bannedUntil: existing?.bannedUntil ?? 0,
      violations,
    });
    return false;
  }

  // Cleanup expired entries every 5 minutes
  if (cfg.enabled) {
    setInterval(
      () => {
        const now = Date.now();
        for (const [key, entry] of windowStore) {
          if (now - entry.windowStart > cfg.windowMs * 2) {
            windowStore.delete(key);
          }
        }
        for (const [ip, ban] of banStore) {
          if (now > ban.bannedUntil && ban.violations < cfg.banThreshold) {
            banStore.delete(ip);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  return async function rateLimitMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | void> {
    if (!cfg.enabled) return next();

    // Skip internal/service paths — no rate limiting
    if (shouldSkip(c.req.path)) return next();

    const ip = getClientIp(c, cfg.trustedProxies);

    if (cfg.whitelist.has(ip)) return next();

    const now = Date.now();

    // --- Check active ban ---
    const ban = banStore.get(ip);
    if (ban && now < ban.bannedUntil) {
      const retryAfter = Math.ceil((ban.bannedUntil - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      c.header("X-RateLimit-Blocked", "true");
      return c.json({ error: "Too many requests — temporarily blocked" }, 429);
    }

    // --- Sliding window check ---
    const bucket = getBucket(c.req.path);
    const limit = getLimit(bucket, cfg);
    const storeKey = `${ip}:${bucket}`;

    let entry = windowStore.get(storeKey);
    if (!entry || now - entry.windowStart > cfg.windowMs) {
      entry = { count: 0, windowStart: now };
    }
    entry.count++;
    windowStore.set(storeKey, entry);

    const remaining = Math.max(0, limit - entry.count);
    const resetSec = Math.ceil((entry.windowStart + cfg.windowMs - now) / 1000);

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetSec));

    if (entry.count > limit) {
      const banned = recordViolation(ip);
      const retryAfter = banned
        ? Math.ceil(cfg.banDurationMs / 1000)
        : resetSec;

      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: banned
            ? "Too many requests — temporarily blocked"
            : "Too many requests",
          retryAfter,
        },
        429,
      );
    }

    return next();
  };
}

// ---------- Config builder ----------

export function buildRateLimitConfig(): RateLimitConfig {
  const raw = process.env;

  const whitelist = new Set<string>(
    (raw.RATE_LIMIT_WHITELIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const trustedProxiesRaw = raw.RATE_LIMIT_TRUSTED_PROXIES;
  const trustedProxies = new Set<string>(
    trustedProxiesRaw !== undefined
      ? trustedProxiesRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ["127.0.0.1", "::1", "::ffff:127.0.0.1"],
  );

  return {
    enabled: raw.RATE_LIMIT_ENABLED === "true",
    windowMs: Number(raw.RATE_LIMIT_WINDOW_MS) || 60_000,
    maxApi: Number(raw.RATE_LIMIT_MAX_API) || 120,
    maxSearch: Number(raw.RATE_LIMIT_MAX_SEARCH) || 30,
    maxCovers: Number(raw.RATE_LIMIT_MAX_COVERS) || 600,
    banThreshold: Number(raw.RATE_LIMIT_BAN_THRESHOLD) || 5,
    banDurationMs: Number(raw.RATE_LIMIT_BAN_DURATION_MS) || 600_000,
    trustedProxies,
    whitelist,
  };
}
