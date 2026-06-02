# monitoring-template

Drop-in observability stack — **Prometheus + Grafana + Loki + Promtail + Node Exporter + Postgres Exporter (opt.)** — that stands up with one command and works on plain Docker, Docker Swarm, or Dokploy.

---

## What's included out of the box

| Component | Role | URL (default) |
|---|---|---|
| Grafana | Dashboards + UI | <http://localhost:3001> |
| Prometheus | Metrics scraper + TSDB | <http://localhost:9090> |
| Loki | Log store (HTTP push API) | <http://localhost:3100> |
| Promtail | Auto-ships Docker stdout to Loki | — |
| Node Exporter | Host CPU/RAM/disk/network | <http://localhost:9100> |
| Postgres Exporter | `pg_stat_*` metrics (optional) | <http://localhost:9187> |

3 provisioned dashboards (folder **App** in Grafana):

| Dashboard | UID | What it shows |
|---|---|---|
| **App Overview** | `app-overview` | RPS, response-time p50/p95/p99, error rate, DB query duration, DB connections, recent logs + errors. Driven by an `app` variable bound to `label_values(http_requests_total, job)` — works for any service exposing those metric names. |
| **VPS System** | `vps-system` | CPU usage by mode, load average, memory, swap, disk usage/IO/IOPS, network traffic/errors, processes, fds. |
| **PostgreSQL** | `postgresql-db` | Connections by state, TPS, row ops, cache hit ratio, locks, deadlocks, table stats, WAL, checkpoints. |

---

## Quickstart (standalone)

```bash
cp .env.example .env
# Edit .env — set GF_SECURITY_ADMIN_PASSWORD and APP_NAME
docker compose up -d --build
```

Then:
- Grafana: <http://localhost:3001> (login `admin` / your password)
- Prometheus targets: <http://localhost:9090/targets>
- Loki Explore in Grafana → Explore → Loki → try `{job=~".+"}`

The default `docker-compose.yml` uses **custom-built images** (`COPY` configs into the image). That's what works in Swarm/Dokploy where bind mounts don't.

## Quickstart (local dev with hot-edit)

For iterating on `prometheus.yml`, `loki-config.yml`, dashboards, etc. without rebuilding:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This swaps the built images for stock upstream ones (`prom/prometheus`, `grafana/loki`, …) and bind-mounts your config files in. After editing:

```bash
# Prometheus hot-reload (requires --web.enable-lifecycle, on by default):
curl -X POST http://localhost:9090/-/reload
# Loki + Promtail config changes require a container restart:
docker compose restart loki promtail
# Grafana picks up new dashboard JSON on file change.
```

## Quickstart (Docker Swarm / Dokploy)

1. In `docker-compose.yml`, uncomment the top-level `networks:` block at the bottom of the file and add `networks: [external_net, default]` to every service.
2. Set `EXTERNAL_NETWORK_NAME=<your-platform-network>` in `.env` (e.g. `dokploy-network`).
3. In `prometheus/prometheus.yml`, uncomment the `__meta_docker_network_name` `keep` relabel and set its regex to that network — without it Docker SD may pick the wrong IP from a multi-attached container.

---

## Connecting your application

### 1. Push structured logs to Loki

Any app can push JSON-line logs to Loki HTTP. The two templates in this monorepo ship a `loki-logger` helper as reference:

- [`server-template/src/utils/loki-logger.ts`](../server-template/src/utils/loki-logger.ts)
- [`web-template/src/middleware.ts`](../web-template/src/middleware.ts) (`pushToLoki` helper)

Both read `LOKI_URL` (default empty = stdout only) and `LOKI_APP_NAME` (the `job=` label that drives the Grafana `app` variable).

### 2. Expose metrics

Add a `/metrics` endpoint to your app using `prom-client` (Node/Bun) or any Prometheus client lib. Then either:

**Option A — Docker SD (recommended for Swarm/Dokploy where container names change on redeploy)**. Adapt the regex in `prometheus/prometheus.yml`:
```yaml
- source_labels: [__meta_docker_container_name]
  regex: '/myapp-.+'        # ← rename to match your container_name
  action: keep
- source_labels: [__meta_docker_network_ip]
  target_label: __address__
  replacement: '${1}:3000'  # ← your in-container /metrics port
```

**Option B — Static target (simpler when names are stable)**:
```yaml
- job_name: "myapp"
  static_configs:
    - targets: ["myapp:3000"]
  metrics_path: /metrics
```

### 3. Auto-shipped Docker logs

You don't need to do anything — Promtail discovers every container on the host and ships `stdout` to Loki with `job=<container_name>`. Filter in Grafana with `{job="my-container"}`.

---

## LogQL cheatsheet

```logql
{job="myapp"}                          # all logs from one container
{job=~".+"} |= "error"                  # errors across everything
{job="myapp"} | json | status >= 500    # 5xx parsed from JSON
{job="myapp"} | json | line_format "{{.method}} {{.path}} {{.ms}}ms"
sum by (status) (
  count_over_time({job="myapp"} | json | __error__="" [5m])
)
```

**Critical**: write your app logs as pure `JSON.stringify(...)` lines — no `level=… msg=…` prefix. The LogQL `| json` parser silently drops lines that don't start with `{`.

---

## Removing components you don't need

| Don't have | Delete |
|---|---|
| Postgres | `postgres-exporter` service in compose; `postgres-exporter` job in `prometheus/prometheus.yml`; `grafana/provisioning/dashboards/postgresql.json` |
| VPS host (running in managed K8s, fly.io, etc.) | `node-exporter` service in compose; `node-exporter` job in `prometheus/prometheus.yml` |
| Loki | `loki` + `promtail` services in compose; Loki datasource in `grafana/provisioning/datasources/datasources.yml`; "Logs" rows in `app-overview.json` |

---

## Operations

```bash
# Check Prometheus is scraping what you expect:
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, instance: .labels.instance, health: .health}'

# Force-reload Prometheus config after editing (build mode):
docker compose restart prometheus
# or in dev mode:
curl -X POST http://localhost:9090/-/reload

# Confirm Loki retention compactor is running:
docker compose logs loki | grep -i compact

# Wipe Grafana state (resets provisioned dashboards from image):
docker compose down
docker volume rm "$(basename "$PWD")_grafana-data"
docker compose up -d --build

# Wipe ALL metric + log history (destructive — only when debugging):
docker compose down -v
```

The volume names are `<COMPOSE_PROJECT_NAME>_<volume>`. `COMPOSE_PROJECT_NAME` defaults to the directory name unless overridden via `PROJECT_NAME` env or `-p` flag.

---

## Before going to production

- [ ] Pin every `:latest` image to a concrete version (`prom/prometheus:v2.55.0`, `grafana/grafana:11.3.0`, etc.) — `latest` will eventually break dashboards or scrape configs unannounced.
- [ ] Set `GF_SECURITY_ADMIN_PASSWORD` to a real secret (the env var uses `:?` so compose refuses to start if empty).
- [ ] Don't expose Prometheus / Loki ports publicly without auth. Both run with no auth by design — they're meant to sit behind your VPS firewall.
- [ ] Verify retention actually applies: `docker compose logs loki | grep compact` should show periodic compactor runs. Without `compactor.retention_enabled: true` + `delete_request_store`, Loki silently never deletes anything.
- [ ] Watch label cardinality. Counters like `http_requests_total{user_id="…"}` will blow up Prometheus memory — use bounded labels (status, route, method) only.
- [ ] If you mount `/var/run/docker.sock`, treat the Prometheus + Promtail containers as root-equivalent on the host.
