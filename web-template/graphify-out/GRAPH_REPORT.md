# Graph Report - .  (2026-06-01)

## Corpus Check
- Corpus is ~7,295 words - fits in a single context window. You may not need a graph.

## Summary
- 106 nodes · 122 edges · 13 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.87)
- Token cost: 9,800 input · 4,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Middleware & IP Handling|Middleware & IP Handling]]
- [[_COMMUNITY_API Client & Data Types|API Client & Data Types]]
- [[_COMMUNITY_Architecture Conventions|Architecture Conventions]]
- [[_COMMUNITY_API Integration Tests|API Integration Tests]]
- [[_COMMUNITY_Security Helpers|Security Helpers]]
- [[_COMMUNITY_SearchBar Interaction|SearchBar Interaction]]
- [[_COMMUNITY_Search & Slug Validation|Search & Slug Validation]]
- [[_COMMUNITY_Loki Logging Pipeline|Loki Logging Pipeline]]
- [[_COMMUNITY_Test Infrastructure|Test Infrastructure]]
- [[_COMMUNITY_Query Params Type|Query Params Type]]
- [[_COMMUNITY_Class Merge Helper|Class Merge Helper]]
- [[_COMMUNITY_Placeholder Constants|Placeholder Constants]]
- [[_COMMUNITY_Favicon Asset|Favicon Asset]]

## God Nodes (most connected - your core abstractions)
1. `onRequest Middleware` - 11 edges
2. `Security Unit Tests` - 10 edges
3. `checkRateLimit` - 7 edges
4. `fetchJson` - 7 edges
5. `API Client Unit Tests` - 7 edges
6. `resolveClientIp` - 5 edges
7. `buildRateLimitConfig` - 5 edges
8. `web-template README` - 5 edges
9. `fetchJson()` - 4 edges
10. `isKnownCrawler` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Auto-built CSP connect-src` --conceptually_related_to--> `buildConnectSrc`  [INFERRED]
  README.md → src/lib/security.ts
- `Structured Loki JSON Logging` --conceptually_related_to--> `pushToLoki`  [INFERRED]
  README.md → src/middleware.ts
- `Trusted-Proxy-Aware Client IP Resolution` --conceptually_related_to--> `resolveClientIp`  [INFERRED]
  README.md → src/lib/security.ts
- `Bot/Crawler Bypass` --conceptually_related_to--> `isKnownCrawler`  [INFERRED]
  README.md → src/lib/security.ts
- `SSR Rate Limiting (sliding window + progressive bans)` --conceptually_related_to--> `checkRateLimit`  [INFERRED]
  README.md → src/lib/security.ts

## Hyperedges (group relationships)
- **SSR Middleware Security Pipeline** — middleware_onrequest, security_resolveclientip, security_isknowncrawler, security_checkratelimit, security_buildconnectsrc, middleware_pushtoloki [INFERRED 0.95]
- **API Error Handling Flow** — api_fetchjson, api_ratelimiterror, api_forbiddenerror, api_notfounderror, middleware_onrequest [INFERRED 0.85]
- **SearchBar Autocomplete Flow** — searchbar_searchbar, searchbar_fetchsuggestions, api_itemsuggest, searchbar_isvalidslug, searchbar_handleselect [EXTRACTED 0.95]

## Communities

### Community 0 - "Middleware & IP Handling"
Cohesion: 0.18
Nodes (16): getClientIp, Astro Config, Bot/Crawler Bypass, Trusted-Proxy-Aware Client IP Resolution, logLine, onRequest Middleware, BOT_UA_PATTERN, buildConnectSrc (+8 more)

### Community 1 - "API Client & Data Types"
Cohesion: 0.18
Nodes (16): fetchJson, ForbiddenError, getItem, getItems, ItemDetail, ItemListItem, ItemsResponse, itemSuggest (+8 more)

### Community 2 - "Architecture Conventions"
Cohesion: 0.15
Nodes (14): web-template CLAUDE Conventions, Auto-built CSP connect-src, Structured Loki JSON Logging, SSR Rate Limiting (sliding window + progressive bans), ImportMetaEnv, getLokiUrl, pushToLoki, web-template README (+6 more)

### Community 3 - "API Integration Tests"
Cohesion: 0.21
Nodes (8): fetchJson(), ForbiddenError, getClientIp(), getItem(), getItems(), itemSuggest(), NotFoundError, RateLimitError

### Community 4 - "Security Helpers"
Cohesion: 0.22
Nodes (4): buildConnectSrc(), isPrivateIp(), originOf(), resolveClientIp()

### Community 5 - "SearchBar Interaction"
Cohesion: 0.53
Nodes (4): handleKeyDown(), handleSelect(), handleSubmit(), isValidSlug()

### Community 6 - "Search & Slug Validation"
Cohesion: 0.4
Nodes (5): Open-Redirect Protection via Slug Validation, handleKeyDown, handleSelect, handleSubmit, isValidSlug

### Community 7 - "Loki Logging Pipeline"
Cohesion: 0.67
Nodes (2): getLokiUrl(), pushToLoki()

### Community 12 - "Test Infrastructure"
Cohesion: 1.0
Nodes (2): Test Setup (jest-dom, cleanup), Vitest Config

### Community 18 - "Query Params Type"
Cohesion: 1.0
Nodes (1): ItemsParams

### Community 19 - "Class Merge Helper"
Cohesion: 1.0
Nodes (1): cn (className merge helper)

### Community 20 - "Placeholder Constants"
Cohesion: 1.0
Nodes (1): constants (placeholder)

### Community 21 - "Favicon Asset"
Cohesion: 1.0
Nodes (1): Favicon SVG (placeholder W)

## Knowledge Gaps
- **17 isolated node(s):** `Astro Config`, `Vitest Config`, `logLine`, `getLokiUrl`, `originOf` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Loki Logging Pipeline`** (4 nodes): `getLokiUrl()`, `logLine()`, `pushToLoki()`, `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Infrastructure`** (2 nodes): `Test Setup (jest-dom, cleanup)`, `Vitest Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Query Params Type`** (1 nodes): `ItemsParams`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Class Merge Helper`** (1 nodes): `cn (className merge helper)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Placeholder Constants`** (1 nodes): `constants (placeholder)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Favicon Asset`** (1 nodes): `Favicon SVG (placeholder W)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `onRequest Middleware` connect `Middleware & IP Handling` to `API Client & Data Types`, `Architecture Conventions`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `API Client Unit Tests` connect `API Client & Data Types` to `Middleware & IP Handling`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `fetchJson` connect `API Client & Data Types` to `Architecture Conventions`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `Astro Config`, `Vitest Config`, `logLine` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._