# Graph Report - /Users/firdavsi/Documents/git/fbusta/templates/server-template  (2026-06-01)

## Corpus Check
- Corpus is ~11,953 words - fits in a single context window. You may not need a graph.

## Summary
- 193 nodes · 215 edges · 35 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Config & Env Setup|Config & Env Setup]]
- [[_COMMUNITY_Integration Tests & Conventions|Integration Tests & Conventions]]
- [[_COMMUNITY_Blocklist Operations (AST)|Blocklist Operations (AST)]]
- [[_COMMUNITY_Blocklist Service Layer|Blocklist Service Layer]]
- [[_COMMUNITY_Item Repository (AST)|Item Repository (AST)]]
- [[_COMMUNITY_Internal Auth Middleware|Internal Auth Middleware]]
- [[_COMMUNITY_Rate Limiting|Rate Limiting]]
- [[_COMMUNITY_Prometheus Metrics|Prometheus Metrics]]
- [[_COMMUNITY_Metrics Middleware|Metrics Middleware]]
- [[_COMMUNITY_Database Connection & Docker|Database Connection & Docker]]
- [[_COMMUNITY_Client IP Resolution|Client IP Resolution]]
- [[_COMMUNITY_HTTP Logger|HTTP Logger]]
- [[_COMMUNITY_Internal Auth Tests|Internal Auth Tests]]
- [[_COMMUNITY_API Test Utilities|API Test Utilities]]
- [[_COMMUNITY_Loki Logging|Loki Logging]]
- [[_COMMUNITY_Item Data Types|Item Data Types]]
- [[_COMMUNITY_Health Endpoint Test|Health Endpoint Test]]
- [[_COMMUNITY_Log Entry Type|Log Entry Type]]
- [[_COMMUNITY_Item Suggestion Type|Item Suggestion Type]]
- [[_COMMUNITY_Paginated Result Type|Paginated Result Type]]
- [[_COMMUNITY_Item List Filters|Item List Filters]]
- [[_COMMUNITY_Item With Rank Type|Item With Rank Type]]
- [[_COMMUNITY_Item Internal Info Type|Item Internal Info Type]]
- [[_COMMUNITY_Table Export|Table Export]]
- [[_COMMUNITY_Seed Sample Data|Seed Sample Data]]
- [[_COMMUNITY_DB Index Definitions|DB Index Definitions]]
- [[_COMMUNITY_Items Query Schema|Items Query Schema]]
- [[_COMMUNITY_Suggest Query Schema|Suggest Query Schema]]
- [[_COMMUNITY_Blocklist Add Schema|Blocklist Add Schema]]
- [[_COMMUNITY_Blocklist Remove Schema|Blocklist Remove Schema]]
- [[_COMMUNITY_Blocklist Bulk Add Schema|Blocklist Bulk Add Schema]]
- [[_COMMUNITY_Blocklist Entry Type|Blocklist Entry Type]]
- [[_COMMUNITY_Bulk Add Item Type|Bulk Add Item Type]]
- [[_COMMUNITY_Bulk Add Result Type|Bulk Add Result Type]]
- [[_COMMUNITY_Test Cache Reset Helper|Test Cache Reset Helper]]

## God Nodes (most connected - your core abstractions)
1. `Hono App Entry Point` - 9 edges
2. `env Config` - 8 edges
3. `items pgTable schema` - 8 edges
4. `items Hono router` - 7 edges
5. `createRateLimiter()` - 6 edges
6. `getClientIp()` - 6 edges
7. `Prometheus Registry` - 6 edges
8. `logger export (info/warn/error)` - 6 edges
9. `resolveCallerIp()` - 5 edges
10. `normalizeIp()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `getClientIp function` --implements--> `Trusted-proxy-aware client IP resolution`  [INFERRED]
  src/utils/get-client-ip.ts → CLAUDE.md
- `findItems function` --implements--> `Routes-Services-Repositories three-layer architecture`  [INFERRED]
  src/repositories/item.repository.ts → CLAUDE.md
- `docker-compose postgres service` --conceptually_related_to--> `pg Pool instance`  [INFERRED]
  docker-compose.yml → src/db/index.ts
- `items Hono router` --implements--> `Routes-Services-Repositories three-layer architecture`  [INFERRED]
  src/routes/items.ts → CLAUDE.md
- `isBlocked function` --implements--> `IP blocklist dual-source merge (env seed + runtime file)`  [INFERRED]
  src/services/blocklist.service.ts → CLAUDE.md

## Hyperedges (group relationships)
- **Request Middleware Pipeline** — metrics_mw_createmetricsmiddleware, http_logger_createhttplogger, ip_blocklist_createipblocklist, rate_limit_createratelimiter, internal_auth_createinternalauth [EXTRACTED 1.00]
- **IP-based Protection Layers (blocklist + rate-limit + internal-auth)** — ip_blocklist_createipblocklist, rate_limit_createratelimiter, internal_auth_createinternalauth [INFERRED 0.95]
- **Prometheus HTTP Metrics Group** — metrics_httprequests_total, metrics_httprequest_duration, metrics_mw_normalizepath [EXTRACTED 1.00]
- **Items request flow: Route → Service → Repository → DB** — routes_items_app, item_service_getitems, item_repo_finditems, db_index_db, schema_items [EXTRACTED 1.00]
- **Blocklist mutation pipeline: route → service → validate → write → log** — routes_internal_app, blocklist_service_addentry, blocklist_service_validatevalue, blocklist_service_writetodisk, loki_logger_logger [EXTRACTED 1.00]
- **IP trust and security: trusted proxy IP resolution feeds rate-limit and blocklist checks** — get_client_ip_getclientip, blocklist_service_isblocked, concept_trusted_proxy_ip, concept_blocklist_dual_source [INFERRED 0.85]

## Communities

### Community 0 - "Config & Env Setup"
Cohesion: 0.12
Nodes (21): blocklist.service Unit Tests, env Config, required(), PATHS Config, Drizzle Config, createHttpLogger, http-logger Unit Tests, Hono App Entry Point (+13 more)

### Community 1 - "Integration Tests & Conventions"
Cohesion: 0.14
Nodes (21): assertExactKeys helper, GET /api/v1/items integration tests, GET /api/v1/items/:slug integration tests, GET /api/v1/items/suggest integration tests, CLAUDE.md server-template conventions, Fire-and-forget side effects pattern, Prometheus path normalization to prevent cardinality explosion, Routes-Services-Repositories three-layer architecture (+13 more)

### Community 2 - "Blocklist Operations (AST)"
Cohesion: 0.21
Nodes (10): addEntry(), bulkAdd(), isBlocked(), isPrivateIp(), loadFromDisk(), readFromDisk(), removeEntry(), ruleMatches() (+2 more)

### Community 3 - "Blocklist Service Layer"
Cohesion: 0.19
Nodes (15): addEntry function, bulkAdd function, isBlocked function, listEntries function, loadFromDisk function, removeEntry function, startTtlCleanup function, validateValue function (+7 more)

### Community 4 - "Item Repository (AST)"
Cohesion: 0.2
Nodes (10): findItemBySlug(), findItems(), findItemSuggestions(), findTopItemsByViews(), incrementViews(), getItemBySlug(), getItems(), getItemSuggestions() (+2 more)

### Community 5 - "Internal Auth Middleware"
Cohesion: 0.27
Nodes (8): createInternalAuth(), getDirectIp(), isPrivateIp(), resolveCallerIp(), createIpBlocklist(), getClientIp(), isPrivateIp(), normalizeIp()

### Community 6 - "Rate Limiting"
Cohesion: 0.27
Nodes (7): createRateLimiter(), getBucket(), getLimit(), shouldSkip(), createApp(), get(), post()

### Community 7 - "Prometheus Metrics"
Cohesion: 0.36
Nodes (8): dbConnectionsActive Gauge, dbQueryDuration Histogram, httpRequestDuration Histogram, httpRequestsTotal Counter, createMetricsMiddleware, normalizePath, metrics-middleware Unit Tests, Prometheus Registry

### Community 8 - "Metrics Middleware"
Cohesion: 0.38
Nodes (4): createMetricsMiddleware(), normalizePath(), createApp(), get()

### Community 9 - "Database Connection & Docker"
Cohesion: 0.29
Nodes (7): drizzle db instance, pg Pool instance, pg Pool verify hook, docker-compose postgres service, findTopItemsByViews raw SQL CTE function, getTopItems function, warmupItemsCache function

### Community 10 - "Client IP Resolution"
Cohesion: 0.4
Nodes (6): Trusted-proxy-aware client IP resolution, getClientIp function, isPrivateIp function, normalizeIp function, getClientIp unit tests, normalizeIp unit tests

### Community 11 - "HTTP Logger"
Cohesion: 0.5
Nodes (3): createHttpLogger(), createApp(), get()

### Community 12 - "Internal Auth Tests"
Cohesion: 0.6
Nodes (3): createApp(), get(), post()

### Community 13 - "API Test Utilities"
Cohesion: 0.67
Nodes (2): get(), json()

### Community 14 - "Loki Logging"
Cohesion: 0.83
Nodes (3): formatLine(), log(), pushToLoki()

### Community 18 - "Item Data Types"
Cohesion: 1.0
Nodes (2): ItemDetail interface, ItemListItem interface

### Community 29 - "Health Endpoint Test"
Cohesion: 1.0
Nodes (1): GET /health integration test

### Community 30 - "Log Entry Type"
Cohesion: 1.0
Nodes (1): LogEntry interface

### Community 31 - "Item Suggestion Type"
Cohesion: 1.0
Nodes (1): ItemSuggestion interface

### Community 32 - "Paginated Result Type"
Cohesion: 1.0
Nodes (1): PaginatedResult generic interface

### Community 33 - "Item List Filters"
Cohesion: 1.0
Nodes (1): ItemListFilters interface

### Community 34 - "Item With Rank Type"
Cohesion: 1.0
Nodes (1): ItemWithRank interface

### Community 35 - "Item Internal Info Type"
Cohesion: 1.0
Nodes (1): ItemInternalInfo interface

### Community 36 - "Table Export"
Cohesion: 1.0
Nodes (1): table const export

### Community 37 - "Seed Sample Data"
Cohesion: 1.0
Nodes (1): SAMPLE_ITEMS demo data constant

### Community 38 - "DB Index Definitions"
Cohesion: 1.0
Nodes (1): INDEXES array with B-tree and GIN trigram examples

### Community 39 - "Items Query Schema"
Cohesion: 1.0
Nodes (1): itemsQuerySchema Zod validator

### Community 40 - "Suggest Query Schema"
Cohesion: 1.0
Nodes (1): suggestQuerySchema Zod validator

### Community 41 - "Blocklist Add Schema"
Cohesion: 1.0
Nodes (1): blocklistAddSchema Zod validator

### Community 42 - "Blocklist Remove Schema"
Cohesion: 1.0
Nodes (1): blocklistRemoveSchema Zod validator

### Community 43 - "Blocklist Bulk Add Schema"
Cohesion: 1.0
Nodes (1): blocklistBulkAddSchema Zod validator

### Community 44 - "Blocklist Entry Type"
Cohesion: 1.0
Nodes (1): BlocklistEntry interface

### Community 45 - "Bulk Add Item Type"
Cohesion: 1.0
Nodes (1): BulkAddItem interface

### Community 46 - "Bulk Add Result Type"
Cohesion: 1.0
Nodes (1): BulkAddResult interface

### Community 47 - "Test Cache Reset Helper"
Cohesion: 1.0
Nodes (1): __resetCacheForTests function

## Knowledge Gaps
- **46 isolated node(s):** `Drizzle Config`, `dbQueryDuration Histogram`, `dbConnectionsActive Gauge`, `getDirectIp`, `isPrivateIp` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `API Test Utilities`** (4 nodes): `api.test.ts`, `assertExactKeys()`, `get()`, `json()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Item Data Types`** (2 nodes): `ItemDetail interface`, `ItemListItem interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Health Endpoint Test`** (1 nodes): `GET /health integration test`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Log Entry Type`** (1 nodes): `LogEntry interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Item Suggestion Type`** (1 nodes): `ItemSuggestion interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Paginated Result Type`** (1 nodes): `PaginatedResult generic interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Item List Filters`** (1 nodes): `ItemListFilters interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Item With Rank Type`** (1 nodes): `ItemWithRank interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Item Internal Info Type`** (1 nodes): `ItemInternalInfo interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Table Export`** (1 nodes): `table const export`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Seed Sample Data`** (1 nodes): `SAMPLE_ITEMS demo data constant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DB Index Definitions`** (1 nodes): `INDEXES array with B-tree and GIN trigram examples`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Items Query Schema`** (1 nodes): `itemsQuerySchema Zod validator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Suggest Query Schema`** (1 nodes): `suggestQuerySchema Zod validator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Blocklist Add Schema`** (1 nodes): `blocklistAddSchema Zod validator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Blocklist Remove Schema`** (1 nodes): `blocklistRemoveSchema Zod validator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Blocklist Bulk Add Schema`** (1 nodes): `blocklistBulkAddSchema Zod validator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Blocklist Entry Type`** (1 nodes): `BlocklistEntry interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bulk Add Item Type`** (1 nodes): `BulkAddItem interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bulk Add Result Type`** (1 nodes): `BulkAddResult interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Cache Reset Helper`** (1 nodes): `__resetCacheForTests function`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getClientIp()` connect `Internal Auth Middleware` to `HTTP Logger`, `Rate Limiting`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `createIpBlocklist()` connect `Internal Auth Middleware` to `Blocklist Operations (AST)`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `isBlocked()` connect `Blocklist Operations (AST)` to `Internal Auth Middleware`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `env Config` (e.g. with `buildInternalAuthConfig` and `buildRateLimitConfig`) actually correct?**
  _`env Config` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `items pgTable schema` (e.g. with `seed script function` and `setupIndexes function`) actually correct?**
  _`items pgTable schema` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `createRateLimiter()` (e.g. with `getClientIp()` and `createApp()`) actually correct?**
  _`createRateLimiter()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Drizzle Config`, `dbQueryDuration Histogram`, `dbConnectionsActive Gauge` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._