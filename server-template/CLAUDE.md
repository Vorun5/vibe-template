# server-template — conventions

This is a backend service template. The conventions below are load-bearing — they hold up rate limiting, observability, security, and DB performance. Don't change them silently.

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

## Layering: Routes → Services → Repositories

- **Routes** (`src/routes/`) — Zod validation on query/params/body, single service call, return JSON. No business logic, no DB.
- **Services** (`src/services/`) — Business logic, in-memory cache, warmup hooks, fire-and-forget side effects.
- **Repositories** (`src/repositories/`) — The only layer that touches the database. Drizzle for normal queries; raw SQL (`db.execute(sql\`…\`)`) for CTEs / window functions / extension-specific operators.

**Never call `db` or `db.execute()` from a route.** A service may not call another service's repository directly — go through the owning service.

## Middleware order (`src/index.ts`)

The order is:

```
metrics → http-logger → ip-blocklist → cors → rate-limit
  → /health → /metrics
  → /internal/* (internal-auth) → /api/v1/*
  → await loadBlocklistFromDisk() → startBlocklistTtlCleanup()
  → warmup*().catch(() => {})
  → export default { port, fetch }
```

- The blocklist file load is `await`ed **before** the server starts taking requests. Otherwise the first requests slip past unchecked.
- Cache warmups are fire-and-forget — never block startup on them.
- `cors` is mounted before `rate-limit` so 429 responses still carry CORS headers (browsers won't surface the error otherwise).

## Caching

- In-memory caches are **per-process**, **cleared on restart**. For multi-replica deploys behind a load balancer, push the cache into Redis instead.
- Every cache needs a `warmup*()` so cold starts don't bottleneck on the first request.
- Don't cache user-specific data here — only resource-level / aggregate data that's safe to share.

## Fire-and-forget side effects

Increments, log pushes, and other "best effort" writes must not block the response:

```ts
incrementViews(slug).catch(() => {});
```

The `.catch(() => {})` is mandatory — an unhandled rejection in fire-and-forget code crashes Bun.

## Prometheus & cardinality

- `normalizePath()` in `src/middleware/metrics.ts` folds dynamic segments (`:slug`, `:id`, `:filename`) before they hit the `path` label. **This is the only thing standing between you and Prometheus OOM.** Every new dynamic route needs a rule added here.
- Never put raw user IDs, slugs, or arbitrary user-supplied strings into a metric label.
- Default-metrics prefix and Loki job label both come from `LOKI_APP_NAME` — set it per environment.

## Internal API security (two layers)

`/internal/*` requires **both**:

1. Direct or proxied IP in `INTERNAL_ALLOWED_IPS`.
2. `X-Internal-Secret` header equal to `INTERNAL_API_SECRET`.

Either alone is insufficient. Hard rules for this middleware:

- `X-Forwarded-For` is honoured **only** when the direct TCP peer IP is in the explicit `INTERNAL_ALLOWED_IPS` set. Do NOT widen this to "any RFC1918 / private IP" — under Docker port publishing every public client arrives with a private bridge-gateway source IP and would walk past the allowlist by spoofing `XFF: 127.0.0.1`.
- `buildInternalAuthConfig()` is fail-fast: it throws on boot if `INTERNAL_API_SECRET` is empty **or** equal to any well-known default in `FORBIDDEN_DEFAULT_SECRETS` (`change-me-in-prod`, `password`, …). Never ship a default secret value in `docker-compose.yml`; require it from `.env`.
- Compare the provided secret with `crypto.timingSafeEqual` after length-checking, never with `===`.

## IP blocklist

Two sources, merged at read time:

- `IP_BLOCKLIST` env var — read-only seed values.
- `${DATA_ROOT}/blocklist.json` — runtime additions/removals via `/internal/blocklist/*`. Atomic write (temp + rename), in-process mutex, TTL cleanup every 10 min.

The service refuses to ban: anything in `RATE_LIMIT_TRUSTED_PROXIES`, anything in `INTERNAL_ALLOWED_IPS`, RFC1918 private networks, and loopback. Without this guard, one bad `/ban` call locks you out of your own service.

## Trusted-proxy aware client IP

`getClientIp()` only honours `X-Forwarded-For` / `X-Real-IP` when the direct connection comes from a trusted proxy or a private network. A public client can set those headers freely, so trusting them blindly lets attackers spoof their IP and bypass rate limiting + blocklist.

## `pg.Pool.verify` hook

`verify` runs once per checkout, **before** the client is handed to the consumer. Use it for session-level setup that should apply to every connection:

- `SET search_path`
- `SET statement_timeout`
- Enabling extensions (`pg_trgm`, etc.)
- Per-session GUCs

The template leaves this hook empty — fill it in if you have session-level needs.

## Tests

- Read-only. The `beforeAll` block only SELECTs seed data; tests never INSERT/UPDATE/DELETE.
- Call `app.fetch(new Request(...))` directly — no real HTTP server is started.
- `assertExactKeys(obj, keys)` enforces shape exactly: extra fields are a failure, not a non-event.
- `internal-auth.test.ts` and `rate-limit.test.ts` test middleware in isolation against a synthetic Hono app; they don't need a database.
- `api.test.ts` requires a running Postgres with at least one published item — the test errors if seed data is missing.
