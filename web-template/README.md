# web-template

Astro 6 SSR + React 19 islands + Tailwind v4 + Bun — production-ready frontend starter with SSR rate limiting, security headers, auto-built CSP, Loki structured logging, bot bypass, no-flash dark mode, and SEO meta / OG / JSON-LD wired in from day one.

---

## Quickstart

```bash
git clone <this-repo> my-frontend && cd my-frontend
bun install
cp .env.example .env
bun run dev          # http://localhost:4321
```

The home page renders even when the API isn't running yet — it falls back to a friendly "API not reachable" notice. Wire up an API at `API_URL`, restart, and the items list fills in.

---

## Architecture

```
Browser
   │  GET /items?page=2
   ▼
┌────────────────────────────────────────────────────────┐
│ Astro middleware (src/middleware.ts)                   │
│   ├─ resolve client IP (trusted-proxy aware)           │
│   ├─ skip static / known crawlers / whitelist          │
│   ├─ rate limit (sliding window + progressive ban)     │
│   └─ on response: add security headers + CSP, log      │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ Page frontmatter (src/pages/items/[slug].astro)        │
│   getItem(slug, getClientIp(Astro))                    │
│      │                                                  │
│      ▼  HTTP + X-Forwarded-For                          │
│   ┌──────────────────────┐                              │
│   │ lib/api.ts            │                              │
│   │   fetchJson           │                              │
│   │   RateLimitError/...  │                              │
│   └──────────────────────┘                              │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ Layout.astro renders + React islands hydrate on client │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼  Response (HTML + headers)
                  X-Frame-Options, CSP, …
```

Layers — don't blur them:

- **`pages/`** — file-based routes. Data fetching only in the frontmatter `---` block. No client-side page data fetching.
- **`layouts/Layout.astro`** — single base layout. SEO, dark mode, gtag (optional).
- **`components/*.astro`** — static markup. No hydration, full HTML for crawlers.
- **`components/react/*.tsx`** — interactive widgets, hydrated with `client:load`.
- **`lib/api.ts`** — only place that constructs API URLs. Throws `RateLimitError`, `ForbiddenError`, `NotFoundError`. Pages translate these into redirects.
- **`middleware.ts`** — runs before every page. Rate limit, security headers, CSP, Loki log. Backstop for uncaught domain errors.

---

## What's included

| Concern | Where | Notes |
|---|---|---|
| SSR rate limit (sliding window + bans) | `src/middleware.ts` | `RATE_LIMIT_WEB_*` env. Off by default. |
| Trusted-proxy aware client IP | `src/middleware.ts`, `src/lib/api.ts` | `TRUSTED_PROXIES` env. Prevents `X-Forwarded-For` spoofing. |
| Bot bypass (search crawlers) | `src/middleware.ts` | UA pattern covers Googlebot/Bingbot/Yandex/DuckDuck/Baidu/Slurp/Sogou/Exabot/Facebot/ia_archiver. |
| Security headers | `src/middleware.ts` | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`. |
| CSP with auto-built `connect-src` | `src/middleware.ts` | Pulls origins from `PUBLIC_API_URL`, `PUBLIC_STATIC_URL`, GA. |
| Structured Loki logging | `src/middleware.ts` | Pure JSON, stdout + HTTP push. `LOKI_APP_NAME` is the job label. |
| 429 inline page | `src/middleware.ts` (`tooManyRequests`) | Self-contained, no Layout dependency. |
| No-flash dark mode | `src/layouts/Layout.astro` | Inline pre-render script. |
| SEO meta / OG / Twitter / JSON-LD | `src/layouts/Layout.astro` | Driven by `PUBLIC_SITE_NAME`, `PUBLIC_SITE_DESCRIPTION`, `PUBLIC_OG_IMAGE`. |
| IP forwarding to upstream API | `src/lib/api.ts` `fetchJson(url, clientIp?)` | `X-Forwarded-For` sent only when `clientIp` is passed. |
| Domain errors | `src/lib/api.ts` | `RateLimitError`, `ForbiddenError`, `NotFoundError`. |
| React island example | `src/components/react/SearchBar.tsx` | Debounced autocomplete (300 ms), keyboard nav, slug validation. |

---

## How to add a new resource

Walk it end-to-end like the `items` example:

1. **Type + API function** — in `src/lib/api.ts`, declare your `Foo` / `FooDetail` / `FoosResponse` types and add `getFoos(params, clientIp?)` and `getFoo(slug, clientIp?)` helpers that call `fetchJson()`.
2. **List page** — `src/pages/foos/index.astro`. Read `page`/`limit` from `Astro.url.searchParams`, call `getFoos(...)` in the frontmatter, render with `<Pagination />`. Pass `getClientIp(Astro)`.
3. **Detail page** — `src/pages/foos/[slug].astro`. Call `getFoo(slug, clientIp)`, redirect to root on `NotFoundError`, use `<Breadcrumbs />`.
4. **Browser-only endpoint** (autocomplete, etc.) — add a `fooSuggest(q)` function that uses `PUBLIC_API_URL`, call it from a React island.
5. **CSP** — if the new endpoint lives on a new origin, expose it via a new `PUBLIC_*` env var and add it to the `CONNECT_SRC` builder in `middleware.ts`.

---

## How to delete the `items` example

If you want a clean slate, remove:

- `src/pages/index.astro` (or rewrite for your domain)
- `src/pages/items/[slug].astro`
- `src/components/react/SearchBar.tsx`
- The `Item*` types and `getItem`, `getItems`, `itemSuggest` exports in `src/lib/api.ts`

The middleware, Layout, generic components (Logo / Pagination / Breadcrumbs / SortBar / HeaderNav), 404 / forbidden / rate-limited pages, and lib infrastructure stay as-is.

---

## Before going to production

- [ ] `RATE_LIMIT_WEB_ENABLED=true`
- [ ] `TRUSTED_PROXIES` lists the real reverse-proxy IPs (Traefik, nginx, Cloudflare). If this is wrong, X-Forwarded-For spoofing bypasses the limiter.
- [ ] `LOKI_URL` set (or accept stdout-only logging).
- [ ] `PUBLIC_SITE_URL`, `PUBLIC_SITE_NAME`, `PUBLIC_SITE_DESCRIPTION`, `PUBLIC_OG_IMAGE` filled in — otherwise OG tags ship with template defaults.
- [ ] Open DevTools → Network → Response Headers and confirm `Content-Security-Policy` includes your real API and static origins under `connect-src`. CSP failures don't show up in app code — they're a silent kill for islands.
- [ ] Favicons in `public/` replaced (only `favicon.svg` ships with the template).
- [ ] `Logo.astro` SVG replaced with your brand.
- [ ] Brand colors set in `src/styles/global.css` (`--primary`, `--secondary`, dark variants).
- [ ] If you want GA, set `PUBLIC_GA_ID=G-XXXXXXXXXX` — Layout will emit the gtag block and the CSP will add Google Analytics origins automatically.
