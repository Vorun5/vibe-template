/**
 * Unit tests for src/lib/security.ts — the pure helpers extracted from the
 * Astro middleware. These don't need an Astro runtime and run cold in jsdom.
 */

import { describe, it, expect } from "vitest";
import {
  BOT_UA_PATTERN,
  SKIP_PREFIXES,
  buildConnectSrc,
  buildRateLimitConfig,
  buildScriptSrcExtra,
  checkRateLimit,
  isKnownCrawler,
  isPrivateIp,
  originOf,
  resolveClientIp,
  shouldSkip,
  tooManyRequests,
  type BanEntry,
  type WindowEntry,
} from "@/lib/security";

// ============================================================
// isPrivateIp
// ============================================================

describe("isPrivateIp", () => {
  it.each([
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["172.16.0.1", true],
    ["172.31.255.254", true],
    ["192.168.1.1", true],
    ["127.0.0.1", true],
    ["::1", true],
    ["::ffff:10.0.0.1", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["172.15.0.1", false], // just below RFC1918 range
    ["172.32.0.1", false], // just above RFC1918 range
    ["192.169.0.1", false],
  ])("classifies %s as private=%s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });
});

// ============================================================
// resolveClientIp
// ============================================================

describe("resolveClientIp", () => {
  function req(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/", { headers });
  }

  it("honours X-Forwarded-For when direct IP is a trusted proxy", () => {
    const ip = resolveClientIp(
      "127.0.0.1",
      req({ "x-forwarded-for": "9.9.9.9, 10.0.0.5" }),
      new Set(["127.0.0.1"]),
    );
    expect(ip).toBe("9.9.9.9");
  });

  it("honours X-Forwarded-For when direct IP is private", () => {
    const ip = resolveClientIp(
      "10.0.0.99",
      req({ "x-forwarded-for": "1.2.3.4" }),
      new Set(),
    );
    expect(ip).toBe("1.2.3.4");
  });

  it("honours X-Real-IP when no X-Forwarded-For but direct is trusted", () => {
    const ip = resolveClientIp(
      "127.0.0.1",
      req({ "x-real-ip": "5.6.7.8" }),
      new Set(["127.0.0.1"]),
    );
    expect(ip).toBe("5.6.7.8");
  });

  it("IGNORES X-Forwarded-For from an untrusted direct IP (spoof protection)", () => {
    const ip = resolveClientIp(
      "8.8.8.8",
      req({ "x-forwarded-for": "127.0.0.1" }),
      new Set(["10.0.0.1"]),
    );
    expect(ip).toBe("8.8.8.8");
  });

  it("falls back to direct IP when trusted but no forwarding headers", () => {
    const ip = resolveClientIp("127.0.0.1", req(), new Set(["127.0.0.1"]));
    expect(ip).toBe("127.0.0.1");
  });

  it("trims the first hop from a comma-separated XFF chain", () => {
    const ip = resolveClientIp(
      "127.0.0.1",
      req({ "x-forwarded-for": "  3.3.3.3 , 4.4.4.4 , 5.5.5.5  " }),
      new Set(["127.0.0.1"]),
    );
    expect(ip).toBe("3.3.3.3");
  });
});

// ============================================================
// Bot detection
// ============================================================

describe("isKnownCrawler", () => {
  function req(ua: string): Request {
    return new Request("http://localhost/", {
      headers: ua ? { "user-agent": ua } : {},
    });
  }

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (compatible; YandexBot/3.0)",
    "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
    "Baiduspider/2.0",
  ])("identifies %s as crawler", (ua) => {
    expect(isKnownCrawler(req(ua))).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    "curl/8.0",
    "",
    "PostmanRuntime/7.39.0",
  ])("does NOT identify %s as crawler", (ua) => {
    expect(isKnownCrawler(req(ua))).toBe(false);
  });

  it("regex pattern is case-insensitive", () => {
    expect(BOT_UA_PATTERN.test("GOOGLEBOT")).toBe(true);
  });
});

// ============================================================
// Skip paths
// ============================================================

describe("shouldSkip", () => {
  it.each([
    "/_astro/index.css",
    "/favicon.ico",
    "/favicon.svg",
    "/robots.txt",
    "/manifest.json",
    "/sitemap.xml",
    "/rate-limited",
    "/rate-limited?retry=60",
  ])("skips %s", (path) => {
    expect(shouldSkip(path)).toBe(true);
  });

  it.each(["/", "/items", "/items/abc", "/api/v1/items", "/forbidden"])(
    "does NOT skip %s",
    (path) => {
      expect(shouldSkip(path)).toBe(false);
    },
  );

  it("exposes a stable SKIP_PREFIXES list", () => {
    expect(SKIP_PREFIXES).toContain("/_astro/");
    expect(SKIP_PREFIXES).toContain("/rate-limited");
    expect(SKIP_PREFIXES).not.toContain("/covers/");
  });
});

// ============================================================
// CSP builders
// ============================================================

describe("originOf", () => {
  it("returns the origin of a valid URL", () => {
    expect(originOf("https://api.example.com/v1/foo")).toBe(
      "https://api.example.com",
    );
  });

  it("returns null for invalid URL", () => {
    expect(originOf("not a url")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(originOf(undefined)).toBeNull();
  });

  it("preserves port", () => {
    expect(originOf("http://localhost:3000/foo")).toBe("http://localhost:3000");
  });
});

describe("buildConnectSrc", () => {
  it("always includes 'self'", () => {
    expect(buildConnectSrc({})).toContain("'self'");
  });

  it("adds origins from PUBLIC_API_URL and PUBLIC_STATIC_URL", () => {
    const csp = buildConnectSrc({
      publicApiUrl: "https://api.example.com/v1",
      publicStaticUrl: "https://cdn.example.com",
    });
    expect(csp).toContain("https://api.example.com");
    expect(csp).toContain("https://cdn.example.com");
  });

  it("dedupes when api and static share an origin", () => {
    const csp = buildConnectSrc({
      publicApiUrl: "http://localhost:3000",
      publicStaticUrl: "http://localhost:3000",
    });
    const count = csp.split("http://localhost:3000").length - 1;
    expect(count).toBe(1);
  });

  it("adds google-analytics origin when gaEnabled is true", () => {
    const csp = buildConnectSrc({ gaEnabled: true });
    expect(csp).toContain("https://www.google-analytics.com");
  });

  it("does NOT add GA origin when gaEnabled is false", () => {
    const csp = buildConnectSrc({ gaEnabled: false });
    expect(csp).not.toContain("google-analytics");
  });

  it("ignores invalid URLs gracefully", () => {
    const csp = buildConnectSrc({ publicApiUrl: "not a url" });
    expect(csp).toBe("'self'");
  });
});

describe("buildScriptSrcExtra", () => {
  it("returns empty string when GA disabled", () => {
    expect(buildScriptSrcExtra(false)).toBe("");
  });

  it("includes both googletagmanager and google-analytics when GA enabled", () => {
    const s = buildScriptSrcExtra(true);
    expect(s).toContain("https://www.googletagmanager.com");
    expect(s).toContain("https://www.google-analytics.com");
  });
});

// ============================================================
// tooManyRequests
// ============================================================

describe("tooManyRequests", () => {
  it("returns a 429 Response", () => {
    const r = tooManyRequests(30, false);
    expect(r.status).toBe(429);
    expect(r.headers.get("Content-Type")).toContain("text/html");
    expect(r.headers.get("Retry-After")).toBe("30");
  });

  it("phrasing differs for banned vs non-banned", async () => {
    const banned = await tooManyRequests(60, true).text();
    const limited = await tooManyRequests(60, false).text();
    expect(banned).toMatch(/temporarily blocked/i);
    expect(limited).toMatch(/too many requests/i);
  });

  it("HTML includes the retryAfter seconds in the body", async () => {
    const text = await tooManyRequests(42, false).text();
    expect(text).toContain("42");
  });
});

// ============================================================
// checkRateLimit
// ============================================================

describe("checkRateLimit", () => {
  function cfg(overrides: Partial<Parameters<typeof checkRateLimit>[1]> = {}) {
    return {
      enabled: true,
      windowMs: 60_000,
      max: 3,
      banThreshold: 2,
      banDurationMs: 600_000,
      whitelist: new Set<string>(),
      trustedProxies: new Set<string>(),
      ...overrides,
    };
  }

  it("allows up to `max` requests within the window", () => {
    const c = cfg({ max: 3 });
    const ws = new Map<string, WindowEntry>();
    const bs = new Map<string, BanEntry>();
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      const d = checkRateLimit("1.2.3.4", c, ws, bs, now);
      expect(d.kind).toBe("allow");
    }
    const blocked = checkRateLimit("1.2.3.4", c, ws, bs, now);
    expect(blocked.kind).toBe("block");
  });

  it("records a non-banned block after the first violation", () => {
    const c = cfg({ max: 1, banThreshold: 3 });
    const ws = new Map<string, WindowEntry>();
    const bs = new Map<string, BanEntry>();
    const now = 1_000_000;
    checkRateLimit("a", c, ws, bs, now); // 1 ok
    const d = checkRateLimit("a", c, ws, bs, now); // 2nd over
    expect(d).toMatchObject({ kind: "block", banned: false });
  });

  it("escalates to banned after banThreshold violations", () => {
    const c = cfg({ max: 1, banThreshold: 2 });
    const ws = new Map<string, WindowEntry>();
    const bs = new Map<string, BanEntry>();
    const now = 1_000_000;
    checkRateLimit("a", c, ws, bs, now);
    checkRateLimit("a", c, ws, bs, now); // violation 1
    const d = checkRateLimit("a", c, ws, bs, now); // violation 2 → ban
    expect(d).toMatchObject({ kind: "block", banned: true });
    // retryAfter should equal banDurationMs / 1000
    if (d.kind === "block") {
      expect(d.retryAfter).toBe(Math.ceil(c.banDurationMs / 1000));
    }
  });

  it("active ban short-circuits the sliding window", () => {
    const c = cfg();
    const ws = new Map<string, WindowEntry>();
    const bs = new Map<string, BanEntry>([
      ["a", { bannedUntil: 2_000_000, violations: 99 }],
    ]);
    const d = checkRateLimit("a", c, ws, bs, 1_500_000);
    expect(d).toMatchObject({ kind: "block", banned: true });
    if (d.kind === "block") expect(d.retryAfter).toBe(500);
  });

  it("ban that has already expired does NOT block", () => {
    const c = cfg();
    const ws = new Map<string, WindowEntry>();
    const bs = new Map<string, BanEntry>([
      ["a", { bannedUntil: 1_000_000, violations: 99 }],
    ]);
    const d = checkRateLimit("a", c, ws, bs, 2_000_000);
    expect(d.kind).toBe("allow");
  });

  it("window resets after windowMs", () => {
    const c = cfg({ max: 1, windowMs: 1000 });
    const ws = new Map<string, WindowEntry>();
    const bs = new Map<string, BanEntry>();
    checkRateLimit("a", c, ws, bs, 0);
    const blocked = checkRateLimit("a", c, ws, bs, 500);
    expect(blocked.kind).toBe("block");
    const allowedAgain = checkRateLimit("a", c, ws, bs, 2000);
    expect(allowedAgain.kind).toBe("allow");
  });

  it("IPs are tracked independently", () => {
    const c = cfg({ max: 1 });
    const ws = new Map<string, WindowEntry>();
    const bs = new Map<string, BanEntry>();
    const now = 0;
    expect(checkRateLimit("a", c, ws, bs, now).kind).toBe("allow");
    expect(checkRateLimit("b", c, ws, bs, now).kind).toBe("allow");
    expect(checkRateLimit("a", c, ws, bs, now).kind).toBe("block");
    expect(checkRateLimit("b", c, ws, bs, now).kind).toBe("block");
  });
});

// ============================================================
// buildRateLimitConfig
// ============================================================

describe("buildRateLimitConfig", () => {
  it("returns defaults when env is empty", () => {
    const c = buildRateLimitConfig({});
    expect(c.enabled).toBe(false);
    expect(c.windowMs).toBe(60_000);
    expect(c.max).toBe(240);
    expect(c.banThreshold).toBe(5);
    expect(c.banDurationMs).toBe(600_000);
    expect(c.whitelist.size).toBe(0);
    // default trusted proxies are loopback
    expect(c.trustedProxies.has("127.0.0.1")).toBe(true);
    expect(c.trustedProxies.has("::1")).toBe(true);
  });

  it("parses comma-separated whitelist", () => {
    const c = buildRateLimitConfig({
      RATE_LIMIT_WEB_WHITELIST: "1.1.1.1, 2.2.2.2 ,3.3.3.3",
    });
    expect([...c.whitelist].sort()).toEqual(["1.1.1.1", "2.2.2.2", "3.3.3.3"]);
  });

  it("flips enabled on RATE_LIMIT_WEB_ENABLED=true", () => {
    expect(buildRateLimitConfig({ RATE_LIMIT_WEB_ENABLED: "true" }).enabled).toBe(true);
    expect(buildRateLimitConfig({ RATE_LIMIT_WEB_ENABLED: "1" }).enabled).toBe(false);
  });

  it("falls back to defaults on non-numeric input", () => {
    const c = buildRateLimitConfig({ RATE_LIMIT_WEB_MAX: "abc" });
    expect(c.max).toBe(240);
  });
});
