// ---------- Base URLs ----------

const API_BASE_URL = import.meta.env.API_URL || "http://localhost:3000";
const API_VERSION = import.meta.env.API_VERSION || "v1";
const API_URL = `${API_BASE_URL}/api/${API_VERSION}`;

const PUBLIC_API_BASE_URL =
  import.meta.env.PUBLIC_API_URL || "http://localhost:3000";
const PUBLIC_API_VERSION = import.meta.env.PUBLIC_API_VERSION || "v1";
const PUBLIC_API_URL = `${PUBLIC_API_BASE_URL}/api/${PUBLIC_API_VERSION}`;

export const PUBLIC_STATIC_URL =
  import.meta.env.PUBLIC_STATIC_URL || "http://localhost:3000";

/** Canonical site origin for SEO (canonical URLs, OG tags, JSON-LD). */
export const SITE_URL = (
  import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321"
).replace(/\/$/, "");

// ---------- Errors ----------

export class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter = 60) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("Not found");
    this.name = "NotFoundError";
  }
}

// ---------- Types ----------
//
// Example domain — replace with your own. The shape mirrors the
// server-template `items` example, so the two templates can run end-to-end
// without any glue code.

export interface ItemListItem {
  slug: string;
  name: string;
  views: number;
}

export interface ItemDetail extends ItemListItem {
  createdAt: string;
}

export interface ItemsResponse {
  list: ItemListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ItemSuggestion {
  slug: string;
  name: string;
}

export interface ItemsParams {
  page?: number;
  limit?: number;
}

// ---------- Client IP helper ----------

import { resolveClientIp } from "@/lib/security";

const TRUSTED_PROXIES = new Set(
  (import.meta.env.TRUSTED_PROXIES ?? "127.0.0.1,::1,::ffff:127.0.0.1")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

/**
 * Extract real client IP from Astro context.
 *
 * SECURITY: Only trusts X-Forwarded-For when the direct connection comes from
 * a trusted proxy (TRUSTED_PROXIES env) or a private network. Prevents IP
 * spoofing attacks against rate limiting / blocklists.
 *
 * Every Astro page should pass `getClientIp(Astro)` into API calls so the
 * upstream API rate limiter sees the real client IP, not the SSR server's IP.
 */
export function getClientIp(astro: {
  clientAddress: string;
  request: Request;
}): string {
  return resolveClientIp(astro.clientAddress, astro.request, TRUSTED_PROXIES);
}

// ---------- fetch helper ----------

async function fetchJson<T>(url: string, clientIp?: string): Promise<T> {
  const headers: HeadersInit = {};
  if (clientIp) headers["X-Forwarded-For"] = clientIp;

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    // Network-level failure — bubble up an empty-looking result. Pages should
    // handle this gracefully so the template works even when the API is down.
    throw new Error(`Network error: ${url}`);
  }

  if (res.status === 429) {
    throw new RateLimitError(Number(res.headers.get("Retry-After")) || 60);
  }
  if (res.status === 401 || res.status === 403) {
    throw new ForbiddenError();
  }
  if (res.status === 404) {
    throw new NotFoundError();
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------- API Functions (replace with your own) ----------

export async function getItems(
  params: ItemsParams = {},
  clientIp?: string,
): Promise<ItemsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) searchParams.set("page", String(params.page));
  if (params.limit !== undefined)
    searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return fetchJson<ItemsResponse>(
    `${API_URL}/items${qs ? `?${qs}` : ""}`,
    clientIp,
  );
}

export async function getItem(
  slug: string,
  clientIp?: string,
): Promise<ItemDetail> {
  return fetchJson<ItemDetail>(`${API_URL}/items/${slug}`, clientIp);
}

/**
 * Browser-only autocomplete endpoint. Called from React islands, so it uses
 * PUBLIC_API_URL (which the browser can reach) instead of API_URL.
 */
export async function itemSuggest(q: string): Promise<ItemSuggestion[]> {
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q });
  return fetchJson<ItemSuggestion[]>(
    `${PUBLIC_API_URL}/items/suggest?${params}`,
  );
}
