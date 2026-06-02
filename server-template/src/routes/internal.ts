import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { findItemInternalInfo } from "@/repositories/item.repository";
import {
  addEntry,
  removeEntry,
  bulkAdd,
  listEntries,
} from "@/services/blocklist.service";

const app = new Hono();

// ---------- Example: internal item info ----------
//
// Demonstrates an internal endpoint that other services call to look up
// resource metadata without exposing it on the public API.

app.get("/items/:slug/info", async (c) => {
  const slug = c.req.param("slug");
  const info = await findItemInternalInfo(slug);

  if (!info) {
    return c.json({ error: "Item not found" }, 404);
  }

  return c.json(info);
});

// ---------- IP blocklist management ----------

const blocklistAddSchema = z.object({
  value: z.string().min(1).max(15),
  addedBy: z.string().min(1).max(100),
  reason: z.string().max(500).optional(),
  ttlMs: z.number().int().positive().optional(),
});

const blocklistRemoveSchema = z.object({
  value: z.string().min(1).max(15),
});

const blocklistBulkAddSchema = z.object({
  entries: z
    .array(
      z.object({
        value: z.string().min(1).max(15),
        reason: z.string().max(500).optional(),
        ttlMs: z.number().int().positive().optional(),
      }),
    )
    .min(1)
    .max(10_000),
  addedBy: z.string().min(1).max(100),
});

app.post(
  "/blocklist/add",
  zValidator("json", blocklistAddSchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid body" }, 400);
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await addEntry({
      value: body.value,
      addedBy: body.addedBy,
      reason: body.reason ?? null,
      ttlMs: body.ttlMs ?? null,
    });
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json({ ok: true, entry: result.entry });
  },
);

app.post(
  "/blocklist/remove",
  zValidator("json", blocklistRemoveSchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid body" }, 400);
  }),
  async (c) => {
    const { value } = c.req.valid("json");
    const { removed } = await removeEntry(value);
    return c.json({ ok: true, removed });
  },
);

app.post(
  "/blocklist/bulk-add",
  zValidator("json", blocklistBulkAddSchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid body" }, 400);
  }),
  async (c) => {
    const { entries, addedBy } = c.req.valid("json");
    const result = await bulkAdd(entries, addedBy);
    return c.json({ ok: true, ...result });
  },
);

app.get("/blocklist", (c) => {
  const data = listEntries();
  return c.json({
    entries: data.entries,
    envSeed: data.envSeed,
    total: data.entries.length,
  });
});

export default app;
