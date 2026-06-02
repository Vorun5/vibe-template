/**
 * Database index setup script.
 *
 * Usage: bun run src/db/setup-indexes.ts
 *
 * Additive only — CREATE INDEX IF NOT EXISTS so it is safe to re-run.
 * No schema modifications, no ALTER TABLE, no column changes.
 *
 * TODO: add your own indexes here. The list below shows two common shapes:
 *   1. B-tree partial index — speeds up filtered + sorted queries.
 *   2. GIN trigram index    — enables fast LIKE / similarity search.
 */

import { Pool } from "pg";
import { env } from "@/config/env";

const pool = new Pool({ connectionString: env.DATABASE_URL });

const INDEXES = [
  // ========================================
  // B-tree partial index example
  // ========================================
  {
    name: "items_published_created_at_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS items_published_created_at_idx
          ON items (created_at DESC) WHERE published = true;`,
    reason:
      "Speeds up the default 'newest published items' query. Partial index keeps it small by only indexing rows where published = true.",
  },

  // ========================================
  // GIN trigram example (commented out by default).
  //
  // Requires pg_trgm extension. To enable, uncomment and also set
  //   `client.query("SET pg_trgm.similarity_threshold = 0.15;")`
  // in src/db/index.ts:verify hook.
  // ========================================
  // {
  //   name: "trgm_items_name_idx",
  //   sql: `CREATE EXTENSION IF NOT EXISTS pg_trgm;
  //         CREATE INDEX CONCURRENTLY IF NOT EXISTS trgm_items_name_idx
  //         ON items USING GIN (name gin_trgm_ops);`,
  //   reason:
  //     "Fast fuzzy search on items.name using the % operator and similarity().",
  // },
];

async function setupIndexes() {
  const client = await pool.connect();

  try {
    for (const index of INDEXES) {
      try {
        console.log(`Creating: ${index.name}`);
        console.log(`  Reason: ${index.reason}`);
        await client.query(index.sql);
        console.log(`  Done.\n`);
      } catch (error) {
        console.error(
          `  Failed: ${error instanceof Error ? error.message : error}\n`,
        );
      }
    }

    console.log("All indexes created successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

setupIndexes().catch(console.error);
