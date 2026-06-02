# Templates — `server-template` + `web-template` + `monitoring-template`

Three production-grade starters that are designed to run together but stay independent.

| | Stack | Default port |
|---|---|---|
| [`server-template/`](./server-template/) | Hono + Bun + PostgreSQL + Drizzle ORM | `3000` |
| [`web-template/`](./web-template/) | Astro 6 SSR + React 19 islands + Tailwind v4 + Bun | `4321` |
| [`monitoring-template/`](./monitoring-template/) | Prometheus + Grafana + Loki + Promtail + Node Exporter + Postgres Exporter | `3001 / 9090 / 3100 / …` |

The shared contract is an HTTP REST API under `/api/v1/items` — the server exposes it, the web client renders it. The monitoring stack auto-discovers them via Docker SD and ships their logs/metrics to Grafana. Any of the three can be replaced or used alone.

---

## One-command demo

From this directory:

```bash
cp .env.example .env                # set GF_SECURITY_ADMIN_PASSWORD
docker compose up -d --build        # postgres → seed → server → web + monitoring
```

The `seed` service is now part of the dependency chain — it creates the `items` table and inserts 12 demo rows before `server` starts. It runs every `docker compose up` but is idempotent (`ON CONFLICT DO NOTHING`), so subsequent boots are no-ops. For production, replace it with real migrations and drop the demo rows.

Then open:

| URL | What |
|---|---|
| <http://localhost:4321> | web-template — items list |
| <http://localhost:3000/api/v1/items> | server-template API |
| <http://localhost:3000/metrics> | Prometheus exposition |
| <http://localhost:9090/targets> | Prometheus targets (`server` should be `UP`) |
| <http://localhost:3001> | Grafana (login `admin` + password from `.env`) |
| <http://localhost:3001/d/app-overview/app-overview> | App Overview dashboard |

The `app` variable in the App Overview dashboard pulls from `label_values(http_requests_total, job)` — once you generate traffic (`curl http://localhost:3000/api/v1/items` a few times), Grafana auto-fills it with `server` and the RPS/latency/error panels light up. Logs land in the Loki panel under both `{job="server"}` (the app's HTTP push via `LOKI_URL`) and `{job="template-server"}` (Promtail picking up the container's stdout).

To wipe state: `docker compose down -v && rm -rf data/`.

---

## Working on the templates in isolation

Each project keeps its own `Dockerfile`, `.env.example`, scripts, and tests. You don't need the root compose to develop them.

```bash
# server only
cd server-template && bun install && cp .env.example .env
docker compose up -d postgres
bun run db:seed && bun run dev      # http://localhost:3000

# web only
cd web-template && bun install && cp .env.example .env
bun run dev                          # http://localhost:4321

# monitoring only
cd monitoring-template && cp .env.example .env
docker compose up -d --build         # Grafana http://localhost:3001
```

---

## How they connect

```
                     ┌──────────────────────────────────────────┐
                     │   web-template (Astro SSR)               │
   browser  ──────►  │   /pages/index.astro                     │
                     │     getItems(..., getClientIp(Astro))    │
                     │       │  X-Forwarded-For: <real ip>      │
                     │       │  stdout → docker → Promtail      │
                     └───────┼───────────────────────────────┬──┘
                             │                                │
                             ▼                                │
                     ┌────────────────────────────┐           │
                     │   server-template (Hono)   │           │
                     │   /api/v1/items            │           │
                     │   /metrics  ───────────────┼──┐        │
                     │   /internal/*              │  │        │
                     │   stdout                   │  │        │
                     └──────────────┬─────────────┘  │        │
                                    │                │        │
                                    ▼                │        ▼
                          PostgreSQL              ┌───────────────────┐
                          ▲                       │ Promtail + Loki   │
                          │                       │  job= label       │
                          │                       └──────────┬────────┘
                  ┌───────┴──────────┐                       │
                  │ postgres-exporter│◄──────────────┐       │
                  └───────┬──────────┘               │       │
                          │ pg_stat_*                │       │
                          ▼                          │       ▼
                  ┌───────────────────────────────────────────────────┐
                  │ Prometheus  ──►  Grafana :3001                     │
                  │  docker_sd target: ${PROJECT_NAME}-server          │
                  │  scrape /metrics on port 3000                      │
                  │  + node-exporter + postgres-exporter               │
                  └───────────────────────────────────────────────────┘
```

### Endpoint ↔ page mapping

| web-template page | API call (`src/lib/api.ts`) | server-template route |
|---|---|---|
| `pages/index.astro` | `getItems(params, clientIp)` | `GET /api/v1/items` |
| `pages/items/[slug].astro` | `getItem(slug, clientIp)` | `GET /api/v1/items/:slug` |
| `components/react/SearchBar.tsx` | `itemSuggest(q)` (browser-only) | `GET /api/v1/items/suggest?q=` |

### Observability wiring

- **Metrics** — server-template exposes `/metrics` on port 3000. Prometheus uses Docker SD to find any container whose name matches the `${PROJECT_NAME}-server` regex, then relabels it with `job=server`. No Prometheus config change required when redeploying.
- **Logs (push)** — both apps' `loki-logger` pushes JSON lines to `LOKI_URL` with `LOKI_APP_NAME` as the `job` label. Wired by the root compose to `LOKI_APP_NAME=server` / `LOKI_APP_NAME=web`.
- **Logs (stdout)** — Promtail discovers every container, ships stdout to Loki with `job=<container_name>`. Works even for containers that don't push directly (postgres, exporters, etc.).
- **Dashboard variable** — `app-overview.json` uses `$app` populated from `label_values(http_requests_total, job)`. Multi-select supported.

---

## Tests

```bash
# server-template
cd server-template
bun install
bun run test          # 95 tests — api + middleware + service

# web-template
cd web-template
bun install
bun run test          # 102 tests — vitest: lib + security + SearchBar
```

`server-template/src/tests/api.test.ts` needs Postgres up + seeded. The rest run without a DB.

The monitoring-template has no test suite — its correctness is verified by `curl http://localhost:9090/api/v1/targets` (every target `UP`) and by the App Overview dashboard rendering data.

---

## Layout

```
.
├── README.md                     ← this file
├── .env.example                  ← root compose env (GF_SECURITY_ADMIN_PASSWORD, ports, ...)
├── docker-compose.yml            ← orchestrates everything below
│
├── server-template/              ← backend, standalone project
│   ├── README.md
│   ├── CLAUDE.md
│   ├── docker-compose.yml        ← postgres-only, used when running solo
│   └── ...
│
├── web-template/                 ← frontend, standalone project
│   ├── README.md
│   ├── CLAUDE.md
│   └── ...
│
└── monitoring-template/          ← Prometheus + Grafana + Loki, standalone project
    ├── README.md
    ├── CLAUDE.md
    ├── docker-compose.yml        ← stack alone (no app)
    ├── docker-compose.dev.yml    ← stock images + bind-mounted configs
    ├── prometheus/
    │   ├── prometheus.yml        ← standalone scrape config
    │   └── prometheus.stack.yml  ← bind-mounted by ROOT compose
    └── ...
```
