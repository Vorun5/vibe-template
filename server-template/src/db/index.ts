import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/config/env";
import { dbConnectionsActive } from "@/metrics";

/**
 * The `verify` hook (pg-pool option) runs once before a client is handed to a
 * consumer, so it is safe to issue session-level SQL here without colliding
 * with concurrent queries (which `pool.on("connect")` would).
 *
 * Use it for session-level configuration that should apply to every
 * connection: `SET search_path`, `SET statement_timeout`, enabling extensions,
 * tweaking pg_trgm.similarity_threshold, etc.
 */
const poolConfig = {
  connectionString: env.DATABASE_URL,
  max: 20,
  verify: (_client: any, done: (err?: Error | null) => void) => {
    // Example:
    //   _client
    //     .query("SET pg_trgm.similarity_threshold = 0.15;")
    //     .then(() => done(null))
    //     .catch(() => done(null));
    done(null);
  },
};

export const pool = new Pool(poolConfig);
export const db = drizzle(pool);

// Refresh active connections gauge on every Prometheus scrape (~30s default).
// totalCount = checked-out + idle + waiting-to-be-released; idleCount = unused.
dbConnectionsActive.collect = function () {
  this.set(pool.totalCount - pool.idleCount);
};
