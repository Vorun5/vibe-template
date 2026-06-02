import {
  findItems,
  findItemBySlug,
  findItemSuggestions,
  findTopItemsByViews,
  incrementViews,
  type PaginatedResult,
  type ItemListItem,
  type ItemDetail,
  type ItemSuggestion,
  type ItemWithRank,
} from "@/repositories/item.repository";

export type { ItemListItem, ItemDetail, ItemSuggestion, PaginatedResult };

export interface GetItemsParams {
  page: number;
  limit: number;
}

// ---------- In-memory cache ----------
//
// Caveat: this cache is per-process. With multiple replicas behind a load
// balancer each replica has its own copy; for distributed cache use Redis.
// The cache is also cleared on every restart — call warmup() from index.ts
// so a cold deploy doesn't bottleneck on the first request.

let topItemsCache: ItemWithRank[] | null = null;

export async function getTopItems(limit = 10): Promise<ItemWithRank[]> {
  if (topItemsCache) return topItemsCache.slice(0, limit);
  topItemsCache = await findTopItemsByViews(50);
  return topItemsCache.slice(0, limit);
}

export async function warmupItemsCache(): Promise<void> {
  topItemsCache = await findTopItemsByViews(50);
}

/** Test-only helper to reset the in-memory cache between tests. */
export function __resetCacheForTests(): void {
  topItemsCache = null;
}

// ---------- Service ----------

export async function getItems(
  params: GetItemsParams,
): Promise<PaginatedResult<ItemListItem>> {
  return findItems({ page: params.page, limit: params.limit });
}

export async function getItemBySlug(slug: string): Promise<ItemDetail | null> {
  const item = await findItemBySlug(slug);
  if (!item) return null;

  // Fire-and-forget side-effects: don't make the response wait, and don't
  // bubble errors back to the client.
  incrementViews(slug).catch(() => {});

  return item;
}

export async function getItemSuggestions(
  q: string,
): Promise<ItemSuggestion[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  return findItemSuggestions(trimmed, 8);
}
