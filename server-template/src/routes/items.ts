import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  getItems,
  getItemBySlug,
  getItemSuggestions,
} from "@/services/item.service";

const itemsQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const suggestQuerySchema = z.object({
  q: z.string().min(1).max(100),
});

const app = new Hono();

app.get("/", zValidator("query", itemsQuerySchema), async (c) => {
  const params = c.req.valid("query");
  const result = await getItems(params);
  return c.json(result);
});

// Order matters: `/suggest` is registered before `/:slug` so a request to
// `/api/v1/items/suggest` doesn't get caught by the slug route.
app.get("/suggest", zValidator("query", suggestQuerySchema), async (c) => {
  const { q } = c.req.valid("query");
  const suggestions = await getItemSuggestions(q);
  return c.json(suggestions);
});

app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const item = await getItemBySlug(slug);

  if (!item) {
    return c.json({ error: "Item not found" }, 404);
  }

  return c.json(item);
});

export default app;
