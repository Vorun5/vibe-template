# server-template

Production-grade backend service template: **Hono + Bun + TypeScript (strict) + PostgreSQL + Drizzle ORM**, with rate limiting, two-layer internal auth, IP blocklist, Prometheus metrics, and Loki-friendly structured logging wired in from day one.

---

## Quickstart

```bash
git clone <this-repo> my-service && cd my-service

bun install

cp .env.example .env
# edit .env: at minimum set DATABASE_URL and INTERNAL_API_SECRET
#   openssl rand -hex 32   ← generate a real secret

docker compose up -d postgres
bun run db:indexes     # creates example indexes (safe to re-run)

bun run dev            # http://localhost:3000
```

Smoke test:

```bash
curl http://localhost:3000/health           # {"status":"ok"}
curl http://localhost:3000/api/v1/items     # paginated items list
curl http://localhost:3000/metrics          # Prometheus exposition
```

---

## Architecture

Three-layer separation. Each layer has exactly one job:

```
┌──────────────────────────────────────────────────────────┐
│ Routes        (src/routes/)                              │
│   Zod validation → call Service → return JSON            │
└─────────────────────┬────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────┐
│ Services      (src/services/)                            │
│   Business logic, in-memory cache, fire-and-forget       │
│   side-effects. Never touches `db.execute` directly.     │
└─────────────────────┬────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────┐
│ Repositories  (src/repositories/)                        │
│   Drizzle queries + raw SQL (CTEs, full-text, windows).  │
│   The only layer that talks to the database.             │
└──────────────────────────────────────────────────────────┘
```

`src/index.ts` mounts middleware in a specific order — DO NOT shuffle:

1. metrics → 2. http-logger → 3. ip-blocklist → 4. CORS → 5. rate-limit → 6. `/health` → 7. `/metrics` → 8. `/internal/*` (with internal-auth) → 9. `/api/v1/*` → 10. blocklist disk load (`await`) → 11. cache warmups (fire-and-forget) → 12. `export default { fetch }`.

---

## Included out of the box

| Concern | Where | Notes |
|---|---|---|
| Rate limit (3 buckets, progressive bans) | `src/middleware/rate-limit.ts` | Sliding window, in-memory. Cleanup every 5 min. |
| Internal API auth (IP + shared secret) | `src/middleware/internal-auth.ts` | Both layers must pass. Fail-fast if `INTERNAL_API_SECRET` unset. |
| IP blocklist (env seed + runtime file) | `src/middleware/ip-blocklist.ts`, `src/services/blocklist.service.ts` | Atomic write, in-process mutex, TTL cleanup, can't ban infra IPs. |
| Prometheus metrics | `src/metrics.ts`, `src/middleware/metrics.ts` | Default process metrics + HTTP + DB. Path normalization is critical. |
| Structured logging (stdout + Loki HTTP push) | `src/utils/loki-logger.ts`, `src/middleware/http-logger.ts` | `LOKI_APP_NAME` controls job label & metric prefix. |
| Health check | `GET /health` | Returns `{ "status": "ok" }`. |
| Trusted-proxy aware client IP | `src/utils/get-client-ip.ts` | Reads `X-Forwarded-For` only when direct IP is trusted or private. |
| pg `Pool` (`max: 20`) + Drizzle | `src/db/index.ts` | `verify` hook is the place for session-level setup. |
| Integration tests via `app.fetch` | `src/tests/api.test.ts` | Read-only; `beforeAll` only SELECTs. |

---

## How to add a new resource

Follow the `items` example end-to-end:

1. **Schema** — add the table in `src/db/schema.ts`, run a migration outside this template (Drizzle Kit / your migration tool of choice). Add B-tree / GIN indexes to `src/db/setup-indexes.ts` and run `bun run db:indexes`.
2. **Repository** — `src/repositories/<resource>.repository.ts`. Drizzle for normal queries; `db.execute(sql\`…\`)` for CTEs / window functions, casting rows via `as unknown as YourType`. If a record needs nested children, batch-load with `WHERE parent_id IN (...)` — never N+1.
3. **Service** — `src/services/<resource>.service.ts`. Cache where it's worth it (long-lived data, expensive aggregates), expose a `warmup*` for `index.ts`. Use `.catch(() => {})` for fire-and-forget side effects.
4. **Route** — `src/routes/<resource>.ts`. Zod-validate query/params, call service, return JSON. No DB calls here.
5. **Mount** — register in `src/index.ts`: `app.route("/api/v1/<resource>", <resource>Routes);`
6. **Metrics normalization** — extend `normalizePath()` in `src/middleware/metrics.ts` to fold dynamic segments to `:slug`/`:id`. Forgetting this step is how Prometheus cardinality explodes.
7. **Tests** — add a `describe` block to `src/tests/api.test.ts`. Use `assertExactKeys` so unexpected fields fail the test.

---

## How to delete the `items` example

If you want a clean slate, remove:

- `src/routes/items.ts`
- `src/services/item.service.ts`
- `src/repositories/item.repository.ts`
- The `items` table block in `src/db/schema.ts`
- The `items_published_created_at_idx` block in `src/db/setup-indexes.ts`
- In `src/index.ts`: the `itemsRoutes` import, `app.route("/api/v1/items", itemsRoutes)` mount, and the `warmupItemsCache()` call
- In `src/routes/internal.ts`: the `findItemInternalInfo` import and the `/items/:slug/info` handler
- In `src/middleware/metrics.ts`: the two `items` replace rules in `normalizePath`
- In `src/tests/api.test.ts`: rewrite against your own resource. Tests for `internal-auth` and `rate-limit` stay as-is.

---

## Environment variables

See `.env.example` for the full list with comments. The two **required** ones (server won't boot without them) are:

- `DATABASE_URL`
- `INTERNAL_API_SECRET`

`PORT` defaults to `3000`, `DATA_ROOT` defaults to `./data`, `LOKI_APP_NAME` defaults to `server-template`.
