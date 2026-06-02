/**
 * Lightweight logger that pushes structured logs to Loki via HTTP.
 *
 * In production (Docker), logs go to stdout and Promtail picks them up.
 * In development (bun run dev), logs are also pushed directly to Loki
 * if LOKI_URL is set (e.g. http://localhost:3100).
 *
 * `LOKI_APP_NAME` is used as the `job` label so Grafana/Promtail can
 * distinguish per-service streams.
 */

const LOKI_URL = process.env.LOKI_URL || "";
const APP_NAME = process.env.LOKI_APP_NAME || "server-template";

interface LogEntry {
  level: "info" | "warn" | "error";
  msg: string;
  [key: string]: unknown;
}

function formatLine(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function pushToLoki(line: string): void {
  if (!LOKI_URL) return;

  const body = JSON.stringify({
    streams: [
      {
        stream: { job: APP_NAME, env: process.env.NODE_ENV || "development" },
        values: [[String(Date.now() * 1_000_000), line]],
      },
    ],
  });

  fetch(`${LOKI_URL}/loki/api/v1/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
}

function log(entry: LogEntry): void {
  const line = formatLine(entry);

  // Always write to stdout
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }

  // Push to Loki (fire-and-forget)
  pushToLoki(line);
}

export const logger = {
  info(msg: string, extra?: Record<string, unknown>) {
    log({ level: "info", msg, ...extra });
  },
  warn(msg: string, extra?: Record<string, unknown>) {
    log({ level: "warn", msg, ...extra });
  },
  error(msg: string, extra?: Record<string, unknown>) {
    log({ level: "error", msg, ...extra });
  },
};
