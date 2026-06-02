/**
 * Idempotent seed script.
 *
 * Usage:
 *   bun run db:seed
 *
 * Creates the `items` table if it doesn't exist (mirrors src/db/schema.ts)
 * and upserts a handful of demo rows. Safe to re-run — uses ON CONFLICT DO
 * NOTHING on the slug unique constraint so existing rows are untouched.
 *
 * This is intentionally a single self-contained script (no drizzle-kit
 * migrations) so the template runs end-to-end on a fresh checkout with a
 * single `docker compose up` + `bun run db:seed`.
 */

import { Pool } from "pg";
import { env } from "@/config/env";

const SAMPLE_ITEMS = [
  { slug: "welcome", name: "Welcome to the template", views: 1024 },
  { slug: "first-steps", name: "First steps with the API", views: 512 },
  { slug: "architecture", name: "Layered architecture in 3 minutes", views: 384 },
  { slug: "routes", name: "Adding a new route", views: 256 },
  { slug: "rate-limiting", name: "How the rate limiter works", views: 200 },
  { slug: "metrics", name: "Prometheus metrics out of the box", views: 180 },
  { slug: "internal-auth", name: "Two-layer internal API auth", views: 140 },
  { slug: "blocklist", name: "IP blocklist runtime mutation", views: 110 },
  { slug: "loki", name: "Structured logging to Loki", views: 90 },
  { slug: "search-suggest", name: "Building autocomplete with /suggest", views: 72 },
  { slug: "drizzle", name: "Drizzle ORM patterns", views: 64 },
  { slug: "raw-sql", name: "When to reach for raw SQL", views: 48 },
];

async function seed() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar NOT NULL UNIQUE,
        name varchar NOT NULL,
        published boolean NOT NULL DEFAULT false,
        views integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS items_published_idx ON items (published);`,
    );

    let inserted = 0;
    for (const item of SAMPLE_ITEMS) {
      const result = await client.query(
        `INSERT INTO items (slug, name, published, views)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (slug) DO NOTHING`,
        [item.slug, item.name, item.views],
      );
      if (result.rowCount && result.rowCount > 0) inserted++;
    }

    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM items WHERE published = true`,
    );
    console.log(
      `Seed done. inserted=${inserted} total_published=${rows[0]?.count ?? 0}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
