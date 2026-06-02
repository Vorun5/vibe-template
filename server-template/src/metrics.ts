import client from "prom-client";

const APP_NAME = process.env.LOKI_APP_NAME || "server_template";

// Prom metric names must match [a-zA-Z_:][a-zA-Z0-9_:]*. Replace common
// kebab-case separators so a LOKI_APP_NAME of "server-template" still works.
const METRIC_PREFIX = `${APP_NAME.replace(/[^a-zA-Z0-9_]/g, "_")}_`;

// Default metrics (process CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ prefix: METRIC_PREFIX });

// ── HTTP metrics ──

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status"] as const,
});

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// ── Database metrics ──

export const dbQueryDuration = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export const dbConnectionsActive = new client.Gauge({
  name: "db_connections_active",
  help: "Number of active database connections",
});

// ── Business metrics ──
//
// TODO: add your own business metrics here. Example shape:
//
//   export const ordersCreatedTotal = new client.Counter({
//     name: "orders_created_total",
//     help: "Total number of orders created",
//     labelNames: ["channel"] as const,
//   });
//
// Keep label cardinality low — never use raw user IDs or slugs as labels.

export const registry = client.register;
