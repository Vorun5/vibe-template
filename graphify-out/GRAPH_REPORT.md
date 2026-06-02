# Graph Report - /Users/firdavsi/Documents/git/fbusta/templates  (2026-06-02)

## Corpus Check
- Corpus is ~24,235 words - fits in a single context window. You may not need a graph.

## Summary
- 286 nodes · 383 edges · 30 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.84)
- Token cost: 9,500 input · 4,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Monitoring & Observability Stack|Monitoring & Observability Stack]]
- [[_COMMUNITY_Web API Client Library|Web API Client Library]]
- [[_COMMUNITY_Astro SSR Middleware|Astro SSR Middleware]]
- [[_COMMUNITY_Server Config & Blocklist Core|Server Config & Blocklist Core]]
- [[_COMMUNITY_IP Blocklist Middleware|IP Blocklist Middleware]]
- [[_COMMUNITY_Internal Auth & IP Utilities|Internal Auth & IP Utilities]]
- [[_COMMUNITY_Frontend API Functions|Frontend API Functions]]
- [[_COMMUNITY_Item Repository Layer|Item Repository Layer]]
- [[_COMMUNITY_Server Infrastructure Config|Server Infrastructure Config]]
- [[_COMMUNITY_Architecture Patterns & Concepts|Architecture Patterns & Concepts]]
- [[_COMMUNITY_Rate Limiting Middleware|Rate Limiting Middleware]]
- [[_COMMUNITY_Prometheus Metrics Middleware|Prometheus Metrics Middleware]]
- [[_COMMUNITY_SearchBar UI Handlers|SearchBar UI Handlers]]
- [[_COMMUNITY_HTTP Request Logger|HTTP Request Logger]]
- [[_COMMUNITY_Loki Logging (Frontend)|Loki Logging (Frontend)]]
- [[_COMMUNITY_API Integration Tests|API Integration Tests]]
- [[_COMMUNITY_Loki Logger Utility|Loki Logger Utility]]
- [[_COMMUNITY_SearchBar Event Handling|SearchBar Event Handling]]
- [[_COMMUNITY_Web Template Brand|Web Template Brand]]
- [[_COMMUNITY_Metrics Middleware Tests|Metrics Middleware Tests]]
- [[_COMMUNITY_Item Type Interfaces|Item Type Interfaces]]
- [[_COMMUNITY_Astro Define Config|Astro Define Config]]
- [[_COMMUNITY_Class Merge Helper|Class Merge Helper]]
- [[_COMMUNITY_Items Response Type|Items Response Type]]
- [[_COMMUNITY_Items Query Params|Items Query Params]]
- [[_COMMUNITY_Frontend Constants Placeholder|Frontend Constants Placeholder]]
- [[_COMMUNITY_HTTP Requests Counter|HTTP Requests Counter]]
- [[_COMMUNITY_HTTP Duration Histogram|HTTP Duration Histogram]]
- [[_COMMUNITY_DB Query Histogram|DB Query Histogram]]
- [[_COMMUNITY_DB Connections Gauge|DB Connections Gauge]]

## God Nodes (most connected - your core abstractions)
1. `security.test.ts (unit test suite)` - 15 edges
2. `server-template service — Hono + Bun + PostgreSQL + Drizzle ORM` - 15 edges
3. `onRequest (Astro SSR middleware)` - 14 edges
4. `Root docker-compose.yml — full stack orchestration` - 12 edges
5. `Loki — log storage (HTTP push API)` - 12 edges
6. `monitoring-template README` - 10 edges
7. `server-template README` - 10 edges
8. `Prometheus — metrics scraper and TSDB` - 9 edges
9. `api.test.ts (unit test suite)` - 8 edges
10. `Hono app (server index.ts)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `resolveClientIp (security.ts)` --semantically_similar_to--> `resolveCallerIp (internal-auth)`  [INFERRED] [semantically similar]
  web-template/src/lib/security.ts → server-template/src/middleware/internal-auth.ts
- `RateLimitConfig interface (security.ts)` --semantically_similar_to--> `RateLimitConfig interface (rate-limit.ts)`  [INFERRED] [semantically similar]
  web-template/src/lib/security.ts → server-template/src/middleware/rate-limit.ts
- `checkRateLimit` --semantically_similar_to--> `createRateLimiter`  [INFERRED] [semantically similar]
  web-template/src/lib/security.ts → server-template/src/middleware/rate-limit.ts
- `onRequest (Astro SSR middleware)` --references--> `ImportMetaEnv interface`  [INFERRED]
  web-template/src/middleware.ts → web-template/src/env.d.ts
- `Templates README — server+web+monitoring overview` --references--> `monitoring-template service — Prometheus+Grafana+Loki+Promtail`  [EXTRACTED]
  README.md → monitoring-template/README.md

## Communities

### Community 0 - "Monitoring & Observability Stack"
Cohesion: 0.14
Nodes (37): GET /health — health check endpoint, GET /api/v1/items — paginated items REST API, GET /api/v1/items/suggest — autocomplete endpoint, GET /metrics — Prometheus exposition endpoint, App Overview Grafana dashboard — RPS/latency/errors/logs, Baked config images — COPY configs for Swarm/Dokploy compatibility, docker_sd_configs — Docker service discovery for Prometheus, Docker socket security risk — root-equivalent host access (+29 more)

### Community 1 - "Web API Client Library"
Cohesion: 0.11
Nodes (12): fetchJson(), ForbiddenError, getClientIp(), getItem(), getItems(), itemSuggest(), NotFoundError, RateLimitError (+4 more)

### Community 2 - "Astro SSR Middleware"
Cohesion: 0.16
Nodes (22): getClientIp (api.ts), getLokiUrl, logLine, onRequest (Astro SSR middleware), pushToLoki, BanEntry interface, BOT_UA_PATTERN, buildConnectSrc (+14 more)

### Community 3 - "Server Config & Blocklist Core"
Cohesion: 0.14
Nodes (20): api.test (integration tests for public API endpoints), blocklist.service (IP blocklist — file + env seed, TTL, mutex), blocklist.service.test (unit tests for blocklist service), env config (DATABASE_URL, PORT, DATA_ROOT), PATHS config (dataRoot), db/index.ts (pg Pool + drizzle instance + metrics hook), schema.ts (items table definition — Drizzle pgTable), seed.ts (idempotent DB seed script) (+12 more)

### Community 4 - "IP Blocklist Middleware"
Cohesion: 0.18
Nodes (11): createIpBlocklist(), addEntry(), bulkAdd(), isBlocked(), isPrivateIp(), loadFromDisk(), readFromDisk(), removeEntry() (+3 more)

### Community 5 - "Internal Auth & IP Utilities"
Cohesion: 0.22
Nodes (10): createInternalAuth(), getDirectIp(), isPrivateIp(), resolveCallerIp(), createApp(), get(), post(), getClientIp() (+2 more)

### Community 6 - "Frontend API Functions"
Cohesion: 0.18
Nodes (15): fetchJson, ForbiddenError, getItem, getItems, itemSuggest, ItemSuggestion interface, NotFoundError, RateLimitError (+7 more)

### Community 7 - "Item Repository Layer"
Cohesion: 0.2
Nodes (10): findItemBySlug(), findItems(), findItemSuggestions(), findTopItemsByViews(), incrementViews(), getItemBySlug(), getItems(), getItemSuggestions() (+2 more)

### Community 8 - "Server Infrastructure Config"
Cohesion: 0.19
Nodes (13): createHttpLogger, buildInternalAuthConfig, InternalAuthConfig interface, createInternalAuth, resolveCallerIp (internal-auth), createIpBlocklist, prom-client registry, buildRateLimitConfig (rate-limit.ts) (+5 more)

### Community 9 - "Architecture Patterns & Concepts"
Cohesion: 0.23
Nodes (13): Astro SSR + React islands pattern, CSP connect-src builder — auto-built from PUBLIC_API_URL env, Drizzle ORM — used in server-template for DB queries, Internal API auth — two-layer IP + shared secret, IP blocklist — env seed + runtime file with TTL, Middleware mount order — load-bearing sequence in index.ts, SSR rate limit — sliding window + progressive bans (web-template), Three-layer architecture — Routes → Services → Repositories (+5 more)

### Community 10 - "Rate Limiting Middleware"
Cohesion: 0.27
Nodes (7): createRateLimiter(), getBucket(), getLimit(), shouldSkip(), createApp(), get(), post()

### Community 11 - "Prometheus Metrics Middleware"
Cohesion: 0.38
Nodes (4): createMetricsMiddleware(), normalizePath(), createApp(), get()

### Community 12 - "SearchBar UI Handlers"
Cohesion: 0.53
Nodes (4): handleKeyDown(), handleSelect(), handleSubmit(), isValidSlug()

### Community 13 - "HTTP Request Logger"
Cohesion: 0.5
Nodes (3): createHttpLogger(), createApp(), get()

### Community 14 - "Loki Logging (Frontend)"
Cohesion: 0.67
Nodes (2): getLokiUrl(), pushToLoki()

### Community 15 - "API Integration Tests"
Cohesion: 0.67
Nodes (2): get(), json()

### Community 16 - "Loki Logger Utility"
Cohesion: 0.83
Nodes (3): formatLine(), log(), pushToLoki()

### Community 17 - "SearchBar Event Handling"
Cohesion: 0.5
Nodes (4): handleKeyDown (SearchBar), handleSelect (SearchBar), handleSubmit (SearchBar), isValidSlug

### Community 18 - "Web Template Brand"
Cohesion: 0.5
Nodes (4): favicon.svg — Web Template Favicon (blue rounded square with white 'W' letter), Layout.astro — base layout with SEO meta and favicon reference, Web Template Brand Identity — blue (#1d9bf0) color scheme with 'W' monogram, web-template/public — Static assets directory

### Community 21 - "Metrics Middleware Tests"
Cohesion: 0.67
Nodes (3): createMetricsMiddleware, metrics-middleware.test (unit tests for metrics middleware), normalizePath (path normalization for Prometheus labels)

### Community 28 - "Item Type Interfaces"
Cohesion: 1.0
Nodes (2): ItemDetail interface, ItemListItem interface

### Community 44 - "Astro Define Config"
Cohesion: 1.0
Nodes (1): defineConfig (astro)

### Community 45 - "Class Merge Helper"
Cohesion: 1.0
Nodes (1): cn (class merge helper)

### Community 46 - "Items Response Type"
Cohesion: 1.0
Nodes (1): ItemsResponse interface

### Community 47 - "Items Query Params"
Cohesion: 1.0
Nodes (1): ItemsParams interface

### Community 48 - "Frontend Constants Placeholder"
Cohesion: 1.0
Nodes (1): constants.ts (placeholder)

### Community 49 - "HTTP Requests Counter"
Cohesion: 1.0
Nodes (1): httpRequestsTotal counter

### Community 50 - "HTTP Duration Histogram"
Cohesion: 1.0
Nodes (1): httpRequestDuration histogram

### Community 51 - "DB Query Histogram"
Cohesion: 1.0
Nodes (1): dbQueryDuration histogram

### Community 52 - "DB Connections Gauge"
Cohesion: 1.0
Nodes (1): dbConnectionsActive gauge

## Knowledge Gaps
- **36 isolated node(s):** `defineConfig (astro)`, `logLine`, `getLokiUrl`, `vitest setup (setup.ts)`, `isValidSlug` (+31 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Loki Logging (Frontend)`** (4 nodes): `getLokiUrl()`, `logLine()`, `pushToLoki()`, `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Integration Tests`** (4 nodes): `api.test.ts`, `assertExactKeys()`, `get()`, `json()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Item Type Interfaces`** (2 nodes): `ItemDetail interface`, `ItemListItem interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Astro Define Config`** (1 nodes): `defineConfig (astro)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Class Merge Helper`** (1 nodes): `cn (class merge helper)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Items Response Type`** (1 nodes): `ItemsResponse interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Items Query Params`** (1 nodes): `ItemsParams interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Constants Placeholder`** (1 nodes): `constants.ts (placeholder)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTTP Requests Counter`** (1 nodes): `httpRequestsTotal counter`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTTP Duration Histogram`** (1 nodes): `httpRequestDuration histogram`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DB Query Histogram`** (1 nodes): `dbQueryDuration histogram`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DB Connections Gauge`** (1 nodes): `dbConnectionsActive gauge`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `security.test.ts (unit test suite)` connect `Astro SSR Middleware` to `Frontend API Functions`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `onRequest (Astro SSR middleware)` connect `Astro SSR Middleware` to `Frontend API Functions`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `checkRateLimit` connect `Astro SSR Middleware` to `Server Infrastructure Config`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `onRequest (Astro SSR middleware)` (e.g. with `RateLimitConfig interface (security.ts)` and `ImportMetaEnv interface`) actually correct?**
  _`onRequest (Astro SSR middleware)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `defineConfig (astro)`, `logLine`, `getLokiUrl` to the rest of the system?**
  _36 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Monitoring & Observability Stack` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Web API Client Library` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._