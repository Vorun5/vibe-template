/**
 * Unit tests for getClientIp + normalizeIp.
 *
 * Stubs the Hono `Context` shape with the minimal surface that
 * `get-client-ip.ts` actually touches: `req.header(name)` and the
 * `getConnInfo` import (which we can't easily mock without intercepting
 * the import). For the latter we rely on the existing implementation's
 * try/catch fallback to "" and exercise the X-Forwarded-For path via
 * the header alone — which means tests skip the "untrusted public IP"
 * negative case at this layer.
 */

import { describe, it, expect } from "bun:test";
import type { Context } from "hono";
import { getClientIp, normalizeIp } from "@/utils/get-client-ip";

function makeCtx(headers: Record<string, string>): Context {
  // Only `req.header()` is consulted from get-client-ip + the getConnInfo
  // helper which throws for non-Bun-runtime requests (we exploit the
  // catch fallback to "" so trustedProxies path is exercised via headers).
  const h = new Headers(headers);
  return {
    req: {
      header: (name: string) => h.get(name) ?? undefined,
    },
  } as unknown as Context;
}

describe("normalizeIp", () => {
  it("strips ::ffff: from IPv4-mapped IPv6", () => {
    expect(normalizeIp("::ffff:10.0.1.12")).toBe("10.0.1.12");
  });

  it("leaves plain IPv4 unchanged", () => {
    expect(normalizeIp("1.2.3.4")).toBe("1.2.3.4");
  });

  it("leaves plain IPv6 unchanged", () => {
    expect(normalizeIp("::1")).toBe("::1");
  });
});

describe("getClientIp", () => {
  // Direct getConnInfo throws in non-Bun runtime → connIp becomes "" and
  // the function returns "unknown" without consulting headers. That's the
  // expected dev-mode behaviour we test here.
  it("returns 'unknown' when getConnInfo is not available and no headers", () => {
    const ctx = makeCtx({});
    const ip = getClientIp(ctx, new Set(["127.0.0.1"]));
    expect(ip).toBe("unknown");
  });

  it("returns 'unknown' even with X-Forwarded-For when direct IP is unknown", () => {
    // Without a trusted direct connection, the header is NOT honoured.
    // This is the IP-spoofing-protection invariant.
    const ctx = makeCtx({ "x-forwarded-for": "9.9.9.9" });
    const ip = getClientIp(ctx, new Set(["127.0.0.1"]));
    expect(ip).toBe("unknown");
  });
});
