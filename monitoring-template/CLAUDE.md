# monitoring-template — conventions

This is a drop-in Prometheus + Grafana + Loki stack. The rules below are load-bearing — break them silently and you end up with no metrics, no logs, or both.

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
- Держи общий объём CLAUDE.md в пределах 3500 токенов. При превышении объедини пересекающиеся правила и удали устаревшие.
- После фикса бага записывай правило про класс корневой причины, а не про конкретный симптом.
- 
## Fixed datasource UIDs

`grafana/provisioning/datasources/datasources.yml` pins `uid: prometheus` and `uid: loki`. Every dashboard JSON references those UIDs directly. If you rename, drop, or auto-generate them, every provisioned dashboard breaks on first redeploy with a confusing "datasource not found" toast. Don't touch.

## Configs are baked into images, not bind-mounted (for prod)

Docker Swarm / Dokploy don't support bind mounts from the host filesystem in the same way `docker compose` does locally. So the default `docker-compose.yml` builds a small image per service (`prometheus/Dockerfile`, `loki/Dockerfile`, …) that `COPY`s the config inside. On config change you rebuild and redeploy.

For local hot-edit, use `docker-compose.dev.yml` which swaps to stock images + bind mounts — but never deploy the dev override to Swarm.

## Loki retention silently no-ops without all three knobs

In `loki-config.yml` you need:

```yaml
limits_config:
  retention_period: 168h     # actual TTL

compactor:
  retention_enabled: true    # arm it
  delete_request_store: ...  # backend that owns the delete log
  compaction_interval: ...   # how often
```

Drop any one and old logs accumulate forever. Verify with `docker compose logs loki | grep compact` — you should see compactor runs every ~10 min.

## Loki log format — pure JSON, no prefix

Apps push logs as `JSON.stringify({...})\n`. **Never** prepend `level=... msg=...` — LogQL's `| json` parser drops mismatched lines silently and your Grafana panels show nothing without a clear error. The two templates' `loki-logger.ts` enforces this; keep it that way.

## docker_sd vs static_configs

- **docker_sd_configs**: container names change between redeploys (Swarm/Dokploy suffix). Prometheus lists every container on the host and filters by name regex. Comes with `/var/run/docker.sock:ro` mount → root-equivalent host access for the container.
- **static_configs**: container name is stable (`docker compose up` without Swarm). Cleaner, no socket mount.

Match the choice to the deploy target, not to "what looks simpler in the template".

## Promtail `container_name` → `job` label

Promtail's relabel block rewrites the Docker `container_name` into the `job` label so LogQL selectors look like `{job="my-container"}`. If an app also pushes logs directly via HTTP using `LOKI_APP_NAME=foo`, you'll see two streams — `job=foo` (from the app's push) and `job=my-container` (from Promtail). That's expected; the app's HTTP push has structured fields, Promtail has raw stdout.

## Grafana provisioning cache

Grafana stores the provisioned dashboards in the `grafana-data` volume. If you edit a dashboard JSON in `grafana/provisioning/dashboards/` and nothing changes after redeploy, **delete the volume** and rebuild: `docker volume rm <project>_grafana-data`. The next start re-imports from the image.

## Docker socket = root on host

`/var/run/docker.sock:ro` gives Prometheus and Promtail effectively root-level access to the host (anyone who can talk to the socket can `docker run --privileged`). Don't expose these containers' ports publicly without auth in front. Read-only on the mount doesn't prevent that — the API is the threat surface, not the file.

## Label cardinality

Counters like `http_requests_total{user_id="..."}` or `books_views_total{slug="..."}` are how you blow up Prometheus RAM. Keep label values bounded — method, status, route template (normalized to `:id`/`:slug`, not the raw values). The server-template's `metrics middleware` has a `normalizePath()` helper that does this; copy the pattern.

## Resource limits

The compose limits (`prometheus: 1G/0.5 CPU`, `grafana: 512M/0.3`, `loki: 512M/0.3`, `promtail: 128M/0.1`, exporters: `64M/0.1`) are right-sized for a $5–10/mo VPS. Bump them if you're collecting from many targets, but don't drop them unless you actively want OOMs.

## Two compose files in this repo

- `monitoring-template/docker-compose.yml` — standalone monitoring stack.
- Root `docker-compose.yml` (one level up) — the full app + monitoring stack, with a bind-mounted `prometheus.stack.yml` tuned to scrape this repo's `server-template` container. Don't merge them — the standalone version needs to keep working without the app templates present.
