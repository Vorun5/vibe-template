/**
 * Astro SSR middleware:
 *   - In-memory rate limiter (sliding window + progressive bans)
 *   - Trusted-proxy aware client IP resolution
 *   - Bot bypass (Googlebot, Bingbot, …)
 *   - Structured Loki logging (JSON, no level=/msg= prefix)
 *   - Security headers (X-Frame-Options, CSP, …)
 *   - RateLimitError / ForbiddenError → redirect to /rate-limited / /forbidden
 *
 * Pure helpers live in `src/lib/security.ts` so they can be unit-tested
 * without an Astro runtime. This file only owns the wiring.
 *
 * ENV configuration: see `.env.example`.
 */

import { defineMiddleware } from "astro:middleware";
import {
  type BanEntry,
  type WindowEntry,
  buildConnectSrc,
  buildRateLimitConfig,
  buildScriptSrcExtra,
  checkRateLimit,
  isKnownCrawler,
  resolveClientIp,
  shouldSkip,
  tooManyRequests,
} from "@/lib/security";

// ---------- Loki logger ----------

const LOKI_APP =
  process.env.LOKI_APP_NAME || import.meta.env.LOKI_APP_NAME || "web";

function getLokiUrl(): string {
  return process.env.LOKI_URL || import.meta.env.LOKI_URL || "";
}

function pushToLoki(line: string): void {
  const lokiUrl = getLokiUrl();
  if (!lokiUrl) return;
  fetch(`${lokiUrl}/loki/api/v1/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      streams: [
        {
          stream: { job: LOKI_APP, env: process.env.NODE_ENV || "development" },
          values: [[String(Date.now() * 1_000_000), line]],
        },
      ],
    }),
  }).catch(() => {});
}

// ---------- Module-load config + stores ----------

const cfg = buildRateLimitConfig(process.env);
const windowStore = new Map<string, WindowEntry>();
const banStore = new Map<string, BanEntry>();

const CONNECT_SRC = buildConnectSrc({
  publicApiUrl: process.env.PUBLIC_API_URL,
  publicStaticUrl: process.env.PUBLIC_STATIC_URL,
  gaEnabled: !!process.env.PUBLIC_GA_ID,
});
const SCRIPT_SRC_EXTRA = buildScriptSrcExtra(!!process.env.PUBLIC_GA_ID);

// Cleanup expired entries every 5 minutes
if (cfg.enabled) {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of windowStore) {
        if (now - entry.windowStart > cfg.windowMs * 2) windowStore.delete(key);
      }
      for (const [ip, ban] of banStore) {
        if (now > ban.bannedUntil && ban.violations < cfg.banThreshold)
          banStore.delete(ip);
      }
    },
    5 * 60 * 1000,
  );
}

// ---------- Middleware ----------

function logLine(extra: Record<string, unknown>): string {
  return JSON.stringify(extra);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;

  if (shouldSkip(pathname)) return next();

  const start = performance.now();
  let directIp = "unknown";
  try {
    directIp = context.clientAddress;
  } catch {
    // clientAddress may not be available in dev mode
  }
  const ip = resolveClientIp(directIp, context.request, cfg.trustedProxies);
  const ua = context.request.headers.get("user-agent") ?? "";

  // --- Rate limiting (only when enabled) ---
  if (
    cfg.enabled &&
    !isKnownCrawler(context.request) &&
    !cfg.whitelist.has(ip)
  ) {
    const decision = checkRateLimit(ip, cfg, windowStore, banStore);
    if (decision.kind === "block") {
      const ms = Math.round(performance.now() - start);
      const line = logLine({
        level: "warn",
        msg: `GET ${pathname}`,
        method: "GET",
        path: pathname,
        status: 429,
        ms,
        ip,
      });
      console.log(line);
      pushToLoki(line);
      return tooManyRequests(decision.retryAfter, decision.banned);
    }
  }

  let response: Response;
  try {
    response = await next();
  } catch (e) {
    if (e instanceof Error && e.name === "RateLimitError") {
      const retryAfter =
        (e as unknown as { retryAfter: number }).retryAfter ?? 60;
      const ms = Math.round(performance.now() - start);
      const line = logLine({
        level: "warn",
        msg: `${context.request.method} ${pathname}`,
        method: context.request.method,
        path: pathname,
        status: 429,
        ms,
        ip,
      });
      console.log(line);
      pushToLoki(line);
      return context.redirect(`/rate-limited?retry=${retryAfter}`);
    }
    if (e instanceof Error && e.name === "ForbiddenError") {
      const ms = Math.round(performance.now() - start);
      const line = logLine({
        level: "warn",
        msg: `${context.request.method} ${pathname}`,
        method: context.request.method,
        path: pathname,
        status: 403,
        ms,
        ip,
      });
      console.log(line);
      pushToLoki(line);
      return context.redirect("/forbidden");
    }
    throw e;
  }

  // --- Security Headers ---
  if (response instanceof Response) {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // 'unsafe-inline' is required for Astro's theme script and Tailwind.
    // For a stricter CSP, switch to a nonce-based approach.
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; " +
        `script-src 'self' 'unsafe-inline' https://fonts.googleapis.com${SCRIPT_SRC_EXTRA}; ` +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        `connect-src ${CONNECT_SRC};`,
    );
  }

  const ms = Math.round(performance.now() - start);
  const status = response instanceof Response ? response.status : 200;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  const line = logLine({
    level,
    msg: `${context.request.method} ${pathname}`,
    method: context.request.method,
    path: pathname,
    status,
    ms,
    ip,
    ua,
  });

  console.log(line);
  pushToLoki(line);

  return response;
});
