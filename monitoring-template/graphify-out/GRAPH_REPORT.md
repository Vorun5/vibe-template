# Graph Report - .  (2026-06-02)

## Corpus Check
- Corpus is ~2,982 words - fits in a single context window. You may not need a graph.

## Summary
- 38 nodes · 66 edges · 6 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Logging & Observability Conventions|Logging & Observability Conventions]]
- [[_COMMUNITY_Grafana Dashboards & Datasources|Grafana Dashboards & Datasources]]
- [[_COMMUNITY_Prometheus Scrape Config|Prometheus Scrape Config]]
- [[_COMMUNITY_Docker Compose Stack|Docker Compose Stack]]
- [[_COMMUNITY_Docker Infrastructure|Docker Infrastructure]]
- [[_COMMUNITY_Loki Storage & Retention|Loki Storage & Retention]]

## God Nodes (most connected - your core abstractions)
1. `docker-compose.yml (Production)` - 8 edges
2. `Prometheus Service` - 8 edges
3. `Loki Service` - 8 edges
4. `CLAUDE.md Conventions` - 8 edges
5. `Grafana Service` - 7 edges
6. `docker-compose.dev.yml (Dev Override)` - 6 edges
7. `Promtail Service` - 6 edges
8. `Datasource UID: prometheus` - 6 edges
9. `prometheus.yml Scrape Config` - 5 edges
10. `Docker Service Discovery (docker_sd_configs)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Docker Service Discovery (docker_sd_configs)` --semantically_similar_to--> `Promtail container_name to job Label Rewrite`  [INFERRED] [semantically similar]
  prometheus/prometheus.yml → CLAUDE.md
- `Grafana Service` --configures--> `Grafana Dashboards Provisioning`  [INFERRED]
  docker-compose.yml → grafana/provisioning/dashboards/dashboards.yml
- `Loki HTTP Push API` --exposes--> `Loki Service`  [INFERRED]
  README.md → docker-compose.yml
- `Dashboard: VPS System (vps-system)` --depends_on--> `Datasource UID: prometheus`  [INFERRED]
  README.md → grafana/provisioning/datasources/datasources.yml
- `Dashboard: PostgreSQL (postgresql-db)` --depends_on--> `Datasource UID: prometheus`  [INFERRED]
  README.md → grafana/provisioning/datasources/datasources.yml

## Hyperedges (group relationships)
- **Loki Retention Requires All Three Knobs** — loki_retention, loki_compactor, loki_config_yml [EXTRACTED 1.00]
- **Grafana Dashboards Depend on Fixed Datasource UIDs** — grafana_dashboards_yml, datasource_uid_prometheus, datasource_uid_loki, dashboard_app_overview [EXTRACTED 1.00]
- **Docker Socket Mount Grants Root Access to Prometheus and Promtail** — docker_socket_mount, prometheus_service, promtail_service [EXTRACTED 1.00]

## Communities

### Community 0 - "Logging & Observability Conventions"
Cohesion: 0.29
Nodes (7): CLAUDE.md Conventions, grafana-data Volume, Grafana Provisioning Cache (grafana-data volume), Prometheus Label Cardinality, Loki HTTP Push API, Loki Pure JSON Log Format, Promtail container_name to job Label Rewrite

### Community 1 - "Grafana Dashboards & Datasources"
Cohesion: 0.43
Nodes (7): Dashboard: App Overview (app-overview), Dashboard: PostgreSQL (postgresql-db), Dashboard: VPS System (vps-system), Datasource UID: loki, Datasource UID: prometheus, Grafana Dashboards Provisioning, Grafana Datasources Provisioning

### Community 2 - "Prometheus Scrape Config"
Cohesion: 0.33
Nodes (7): Docker Service Discovery (docker_sd_configs), Node Exporter Service, Postgres Exporter Service, Prometheus Scrape Job: myapp, Prometheus Scrape Job: node-exporter, Prometheus Scrape Job: postgres-exporter, prometheus.yml Scrape Config

### Community 3 - "Docker Compose Stack"
Cohesion: 0.6
Nodes (6): docker-compose.dev.yml (Dev Override), docker-compose.yml (Production), Grafana Service, loki-data Volume, Loki Service, monitoring-template Stack

### Community 4 - "Docker Infrastructure"
Cohesion: 0.5
Nodes (5): Docker Socket Mount (/var/run/docker.sock), External Network for Swarm/Dokploy, prometheus-data Volume, Prometheus Service, Promtail Service

### Community 5 - "Loki Storage & Retention"
Cohesion: 0.5
Nodes (4): Loki Compactor, Loki Ingester, Loki Retention Config, Loki Schema Config (tsdb v13)

## Knowledge Gaps
- **5 isolated node(s):** `prometheus-data Volume`, `loki-data Volume`, `Prometheus Label Cardinality`, `Loki Schema Config (tsdb v13)`, `Loki Ingester`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Loki Service` connect `Docker Compose Stack` to `Logging & Observability Conventions`, `Grafana Dashboards & Datasources`, `Docker Infrastructure`, `Loki Storage & Retention`?**
  _High betweenness centrality (0.346) - this node is a cross-community bridge._
- **Why does `CLAUDE.md Conventions` connect `Logging & Observability Conventions` to `Grafana Dashboards & Datasources`, `Prometheus Scrape Config`, `Docker Compose Stack`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **Why does `Prometheus Service` connect `Docker Infrastructure` to `Grafana Dashboards & Datasources`, `Prometheus Scrape Config`, `Docker Compose Stack`?**
  _High betweenness centrality (0.193) - this node is a cross-community bridge._
- **What connects `prometheus-data Volume`, `loki-data Volume`, `Prometheus Label Cardinality` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._