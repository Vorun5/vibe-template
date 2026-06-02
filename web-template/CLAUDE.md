# web-template — conventions

This is an Astro SSR + React islands + Tailwind v4 starter. The rules below are load-bearing — they protect SEO, security, and core UX. Don't change them silently.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Self-improvement protocol
- После любой моей коррекции ты обязан предложить лаконичное правило и дописать его в этот CLAUDE.md в подходящую секцию.
- Формат правила: одно императивное предложение, без обоснования и без примеров, если случай не двусмысленный.
- Перед добавлением правила выполни поиск по этому файлу. Если уже есть правило, покрывающее этот случай, не дублируй, а уточни существующее.
- Держи общий объём CLAUDE.md в пределах 4500 токенов. При превышении объедини пересекающиеся правила и удали устаревшие.
- После фикса бага записывай правило про класс корневой причины, а не про конкретный симптом.
- 
## Architecture: SSR first, React for interactivity only

- **Pages** (`src/pages/*.astro`) — file-based routing. Data fetching happens **only in frontmatter** (the `---` block). No client-side fetching of page data; the page must be fully rendered HTML on first response.
- **Layout** (`src/layouts/Layout.astro`) — the single base layout. SEO meta, OG, Twitter card, canonical, JSON-LD, no-flash dark mode, optional GA.
- **Components**
  - `.astro` for static markup (cards, headers, buttons, wrappers). No hydration cost, full HTML for crawlers.
  - `.tsx` under `src/components/react/` for interactive widgets only. Hydrate with `client:load` (or `client:idle` for below-the-fold). Use these only when the widget owns local state (autocomplete, modals, theme controls, etc.).
- **Lib** (`src/lib/`) — `api.ts` is the only place that builds API URLs and throws domain errors. `utils.ts` is the `cn()` helper. Never inline API base URLs into pages or components.

## Data fetching

- Frontmatter only. If you need browser-side data, expose a typed function in `api.ts` and call it from a React island.
- Every page passes `getClientIp(Astro)` into API functions. The API gets the real client IP via `X-Forwarded-For` so its rate limiter doesn't count the SSR server as one chatty user.
- Wrap API calls in try/catch and translate domain errors:
  - `RateLimitError` → `Astro.redirect("/rate-limited?retry=…")`
  - `ForbiddenError` → `Astro.redirect("/forbidden")`
  - `NotFoundError` → resource-specific 404 / redirect.

The middleware also catches these errors as a backstop, but per-page handling lets you choose the redirect target (e.g. category vs root).

## IP forwarding

- `api.ts` `fetchJson()` adds `X-Forwarded-For: <clientIp>` whenever `clientIp` is passed. SSR-side calls take it; browser-side calls (React islands) don't need to — the API sees the browser's IP directly.
- `getClientIp(Astro)` only honours `X-Forwarded-For` / `X-Real-IP` when the direct connection comes from `TRUSTED_PROXIES` or a private network. Anything else returns the connection IP. This blocks spoofing.

## CSP `connect-src` (load-bearing!)

The middleware builds `connect-src` from `PUBLIC_API_URL`, `PUBLIC_STATIC_URL`, and (when `PUBLIC_GA_ID` is set) Google Analytics. If a React island starts calling a new origin, **add it here** or every XHR will fail silently — browser CSP errors are easy to miss in DevTools because they don't surface in app code.

## Loki structured logging

- Push log entries as pure `JSON.stringify({...})`. Do **not** prepend `level=… msg=…` — LogQL's `| json` parser silently drops mismatched lines, and you lose visibility.
- `LOKI_APP_NAME` is the `job` label; pick something distinct per service so streams don't collide.

## iOS Safari input zoom

Inputs, textareas, and selects must compute to `font-size >= 16px` on touch screens. The `@media (hover: none) and (pointer: coarse)` block in `global.css` enforces this. If you override it locally, ensure your override still meets 16px on mobile.

## Standalone pages (no Layout)

If a page has its own header/footer and doesn't use `Layout.astro`, **manually inline** the same SEO infrastructure: `<meta description>`, canonical, OG, Twitter card, favicon, theme-color, JSON-LD, and (when enabled) gtag. Otherwise the page gets indexed without proper metadata.

## DTO sync

When the API changes a response shape, update the matching type in `src/lib/api.ts` in the same change. Type errors at the page level are the signal — don't paper over them with `any`.

## SEO

- Don't disallow listing / resource pages in `robots.txt` — those are SEO entry points. Only utility pages (`/rate-limited`, `/forbidden`) go in `Disallow`.
- Don't insert countdowns, wait-gates, or "click to continue" before primary CTAs — Google demotes these as low-value experiences.

## Path alias

`@/*` → `src/*`. Use it everywhere; don't write relative imports across directory levels.
