/**
 * Pure security/middleware helpers, isolated from the Astro runtime so they
 * can be unit-tested with vitest without an Astro context.
 *
 * Anything that needs `defineMiddleware` / `Astro` belongs in
 * `src/middleware.ts`; anything pure lives here.
 */

// ---------- IP detection ----------

/**
 * Check if an IP is in a private network range (RFC 1918) or loopback.
 * Used to decide whether to honour an X-Forwarded-For header.
 */
export function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, "");
  return (
    clean.startsWith("10.") ||
    clean.startsWith("172.16.") ||
    clean.startsWith("172.17.") ||
    clean.startsWith("172.18.") ||
    clean.startsWith("172.19.") ||
    clean.startsWith("172.20.") ||
    clean.startsWith("172.21.") ||
    clean.startsWith("172.22.") ||
    clean.startsWith("172.23.") ||
    clean.startsWith("172.24.") ||
    clean.startsWith("172.25.") ||
    clean.startsWith("172.26.") ||
    clean.startsWith("172.27.") ||
    clean.startsWith("172.28.") ||
    clean.startsWith("172.29.") ||
    clean.startsWith("172.30.") ||
    clean.startsWith("172.31.") ||
    clean.startsWith("192.168.") ||
    clean === "127.0.0.1" ||
    clean === "::1"
  );
}

/**
 * Resolve a client IP from a direct-connection IP + optional Request,
 * honouring X-Forwarded-For only when the direct IP is trusted.
 *
 * Returns the connection IP as-is when the proxy chain is untrusted.
 */
export function resolveClientIp(
  directIp: string,
  request: Request,
  trustedProxies: Set<string>,
): string {
  if (directIp && (trustedProxies.has(directIp) || isPrivateIp(directIp))) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return directIp;
}

// ---------- Bot detection ----------

// UA-based detection is spoofable but covers legitimate crawlers. For
// Googlebot crawl rate management use Google Search Console.
export const BOT_UA_PATTERN =
  /googlebot|googleother|bingbot|yandexbot|duckduckbot|baiduspider|slurp|sogou|exabot|facebot|ia_archiver/i;

export function isKnownCrawler(request: Request): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return BOT_UA_PATTERN.test(ua);
}

// ---------- Skip paths ----------

export const SKIP_PREFIXES = [
  "/_astro/",
  "/favicon",
  "/robots.txt",
  "/manifest",
  "/sitemap",
  "/rate-limited",
];

export function shouldSkip(pathname: string): boolean {
  return SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

// ---------- CSP origin builder ----------

export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Build the CSP `connect-src` directive value from PUBLIC_* env. */
export function buildConnectSrc(opts: {
  publicApiUrl?: string;
  publicStaticUrl?: string;
  gaEnabled?: boolean;
}): string {
  const origins = new Set<string>(["'self'"]);
  for (const v of [opts.publicApiUrl, opts.publicStaticUrl]) {
    const o = originOf(v);
    if (o) origins.add(o);
  }
  if (opts.gaEnabled) origins.add("https://www.google-analytics.com");
  return [...origins].join(" ");
}

export function buildScriptSrcExtra(gaEnabled: boolean): string {
  return gaEnabled
    ? " https://www.googletagmanager.com https://www.google-analytics.com"
    : "";
}

// ---------- 429 page ----------

/**
 * Self-contained 429 page. Not styled by Layout because it can be served
 * before any page module is touched.
 *
 * TODO: replace the inline copy and styling to match your brand / language.
 */
export function tooManyRequests(retryAfter: number, banned: boolean): Response {
  const message = banned
    ? `You are temporarily blocked. Try again in ${retryAfter}s.`
    : `Too many requests. Try again in ${retryAfter}s.`;

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>429 — Too Many Requests</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#111}
    h1{font-size:1.5rem;margin-bottom:.5rem}
    p{color:#555;margin:.4rem 0}
    .hint{background:#f5f5f5;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:.9rem}
    a{color:#1d9bf0}
  </style>
</head>
<body>
  <h1>429 — Too Many Requests</h1>
  <p>${message}</p>
  <div class="hint">
    <p>If you are using a <b>VPN</b> or a shared network, try turning the VPN off and refreshing.</p>
  </div>
  <p style="margin-top:20px"><a href="/">← Home</a></p>
</body>
</html>`,
    {
      status: 429,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

// ---------- Sliding window rate limiter ----------

export interface WindowEntry {
  count: number;
  windowStart: number;
}

export interface BanEntry {
  bannedUntil: number;
  violations: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
  banThreshold: number;
  banDurationMs: number;
  whitelist: Set<string>;
  trustedProxies: Set<string>;
}

export type LimitDecision =
  | { kind: "allow" }
  | { kind: "block"; retryAfter: number; banned: boolean };

/**
 * Pure function for the rate-limit decision. Mutates the provided stores;
 * the caller owns store lifecycle (so tests can inject fresh Maps).
 */
export function checkRateLimit(
  ip: string,
  cfg: RateLimitConfig,
  windowStore: Map<string, WindowEntry>,
  banStore: Map<string, BanEntry>,
  now: number = Date.now(),
): LimitDecision {
  // Check active ban
  const ban = banStore.get(ip);
  if (ban && now < ban.bannedUntil) {
    return {
      kind: "block",
      retryAfter: Math.ceil((ban.bannedUntil - now) / 1000),
      banned: true,
    };
  }

  // Sliding window
  let entry = windowStore.get(ip);
  if (!entry || now - entry.windowStart > cfg.windowMs) {
    entry = { count: 0, windowStart: now };
  }
  entry.count++;
  windowStore.set(ip, entry);

  if (entry.count > cfg.max) {
    const existing = banStore.get(ip);
    const violations = (existing?.violations ?? 0) + 1;
    const resetSec = Math.ceil(
      (entry.windowStart + cfg.windowMs - now) / 1000,
    );

    if (violations >= cfg.banThreshold) {
      banStore.set(ip, {
        bannedUntil: now + cfg.banDurationMs,
        violations,
      });
      return {
        kind: "block",
        retryAfter: Math.ceil(cfg.banDurationMs / 1000),
        banned: true,
      };
    }

    banStore.set(ip, {
      bannedUntil: existing?.bannedUntil ?? 0,
      violations,
    });
    return { kind: "block", retryAfter: resetSec, banned: false };
  }

  return { kind: "allow" };
}

// ---------- Config builder ----------

export function buildRateLimitConfig(env: Record<string, string | undefined>): RateLimitConfig {
  const whitelist = new Set<string>(
    (env.RATE_LIMIT_WEB_WHITELIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const trustedProxies = new Set<string>(
    (env.TRUSTED_PROXIES ?? "127.0.0.1,::1,::ffff:127.0.0.1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  return {
    enabled: env.RATE_LIMIT_WEB_ENABLED === "true",
    windowMs: Number(env.RATE_LIMIT_WEB_WINDOW_MS) || 60_000,
    max: Number(env.RATE_LIMIT_WEB_MAX) || 240,
    banThreshold: Number(env.RATE_LIMIT_WEB_BAN_THRESHOLD) || 5,
    banDurationMs: Number(env.RATE_LIMIT_WEB_BAN_DURATION_MS) || 600_000,
    whitelist,
    trustedProxies,
  };
}
