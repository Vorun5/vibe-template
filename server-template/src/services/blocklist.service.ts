/**
 * IP blocklist service.
 *
 * Source of truth = a JSON file under DATA_ROOT (default `./data/blocklist.json`)
 * merged with the static IP_BLOCKLIST env var. Env entries are seed-only and
 * cannot be removed at runtime.
 *
 * Format of a `value`:
 *   - 4 octets ("1.2.3.4") → exact-IP match
 *   - 3 octets ("1.2.3")   → matches the whole /24 pool 1.2.3.*
 *
 * Persistence: atomic write (write to .tmp, rename) protected by an in-process
 * mutex so two concurrent /ban calls cannot tear the file.
 *
 * TTL: entries with `expiresAt` get filtered out on read (lazy) and a periodic
 * cleanup interval rewrites the file.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS } from "@/config/paths";
import { logger } from "@/utils/loki-logger";

const MAX_ENTRIES = 10_000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const BLOCKLIST_FILE = path.join(PATHS.dataRoot, "blocklist.json");

// ---------- Types ----------

export interface BlocklistEntry {
  value: string;
  addedAt: number;
  addedBy: string;
  reason: string | null;
  expiresAt: number | null;
}

export interface BulkAddItem {
  value: string;
  reason?: string;
  ttlMs?: number;
}

export interface BulkAddResult {
  added: number;
  skipped: { value: string; reason: string }[];
}

// ---------- State ----------

// Runtime entries from the JSON file.
let fileEntries: BlocklistEntry[] = [];

// Seed values from IP_BLOCKLIST env var (immutable, no metadata).
const envSeed = new Set<string>(
  (process.env.IP_BLOCKLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// Promise chain used as a simple write mutex.
let writeQueue: Promise<void> = Promise.resolve();

// ---------- Forbidden values ----------

const FORBIDDEN_SET = new Set<string>(
  [
    ...(process.env.RATE_LIMIT_TRUSTED_PROXIES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ...(process.env.INTERNAL_ALLOWED_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ],
);

function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, "");
  return (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    (clean.startsWith("172.") &&
      (() => {
        const second = parseInt(clean.split(".")[1] ?? "0", 10);
        return second >= 16 && second <= 31;
      })())
  );
}

// ---------- Validation ----------

const OCTET_RE = /^(0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;

export function validateValue(value: string): { ok: true } | { ok: false; reason: string } {
  if (typeof value !== "string") return { ok: false, reason: "not a string" };
  const parts = value.split(".");
  if (parts.length !== 3 && parts.length !== 4) {
    return { ok: false, reason: "expected 3 or 4 octets" };
  }
  for (const p of parts) {
    if (!OCTET_RE.test(p)) return { ok: false, reason: `invalid octet "${p}"` };
  }

  // Refuse to ban infrastructure addresses.
  if (FORBIDDEN_SET.has(value)) {
    return { ok: false, reason: "infrastructure address — refused" };
  }
  if (parts.length === 4 && isPrivateIp(value)) {
    return { ok: false, reason: "private network — refused" };
  }
  return { ok: true };
}

// ---------- Match ----------

function ruleMatches(rule: string, ip: string): boolean {
  const parts = rule.split(".");
  if (parts.length === 4) return ip === rule;
  // /24 prefix — `rule + "."` so "1.2.3" does NOT match "1.2.30.4"
  return ip.startsWith(rule + ".");
}

export function isBlocked(ip: string): boolean {
  const now = Date.now();
  for (const rule of envSeed) {
    if (ruleMatches(rule, ip)) return true;
  }
  for (const entry of fileEntries) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) continue;
    if (ruleMatches(entry.value, ip)) return true;
  }
  return false;
}

// ---------- Persistence ----------

async function ensureDir(): Promise<void> {
  await fs.mkdir(PATHS.dataRoot, { recursive: true });
}

async function readFromDisk(): Promise<BlocklistEntry[]> {
  try {
    const raw = await fs.readFile(BLOCKLIST_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWellFormed);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    logger.error("blocklist read failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

function isWellFormed(o: unknown): o is BlocklistEntry {
  if (!o || typeof o !== "object") return false;
  const e = o as Record<string, unknown>;
  return (
    typeof e.value === "string" &&
    typeof e.addedAt === "number" &&
    typeof e.addedBy === "string" &&
    (e.reason === null || typeof e.reason === "string") &&
    (e.expiresAt === null || typeof e.expiresAt === "number")
  );
}

function writeToDisk(entries: BlocklistEntry[]): Promise<void> {
  // Chain on the queue to serialize writes.
  const task = writeQueue.then(async () => {
    await ensureDir();
    const tmp = BLOCKLIST_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(entries, null, 2), "utf-8");
    await fs.rename(tmp, BLOCKLIST_FILE);
  });
  writeQueue = task.catch(() => {});
  return task;
}

export async function loadFromDisk(): Promise<void> {
  fileEntries = await readFromDisk();
  logger.info("blocklist loaded", {
    fileEntries: fileEntries.length,
    envEntries: envSeed.size,
  });
}

// ---------- Mutations ----------

export async function addEntry(input: {
  value: string;
  addedBy: string;
  reason?: string | null;
  ttlMs?: number | null;
}): Promise<{ ok: true; entry: BlocklistEntry } | { ok: false; error: string }> {
  const v = validateValue(input.value);
  if (!v.ok) return { ok: false, error: v.reason };

  if (fileEntries.length >= MAX_ENTRIES) {
    // Allow update of an existing entry even when full; refuse only new entries.
    const exists = fileEntries.some((e) => e.value === input.value);
    if (!exists) return { ok: false, error: "blocklist is full" };
  }

  const now = Date.now();
  const entry: BlocklistEntry = {
    value: input.value,
    addedAt: now,
    addedBy: input.addedBy,
    reason: input.reason ?? null,
    expiresAt:
      input.ttlMs && input.ttlMs > 0 ? now + input.ttlMs : null,
  };

  // Idempotent: replace existing entry with same value (refreshes expiresAt/reason).
  const idx = fileEntries.findIndex((e) => e.value === input.value);
  if (idx >= 0) fileEntries[idx] = entry;
  else fileEntries.push(entry);

  await writeToDisk(fileEntries);

  logger.info("blocklist add", {
    event: "blocklist_change",
    action: "add",
    value: entry.value,
    addedBy: entry.addedBy,
    reason: entry.reason,
    expiresAt: entry.expiresAt,
  });

  return { ok: true, entry };
}

export async function removeEntry(value: string): Promise<{ removed: boolean }> {
  const before = fileEntries.length;
  fileEntries = fileEntries.filter((e) => e.value !== value);
  const removed = fileEntries.length < before;

  if (removed) {
    await writeToDisk(fileEntries);
    logger.info("blocklist remove", {
      event: "blocklist_change",
      action: "remove",
      value,
    });
  }

  return { removed };
}

export async function bulkAdd(
  items: BulkAddItem[],
  addedBy: string,
): Promise<BulkAddResult> {
  const skipped: { value: string; reason: string }[] = [];
  let added = 0;
  const now = Date.now();

  for (const item of items) {
    const v = validateValue(item.value);
    if (!v.ok) {
      skipped.push({ value: item.value, reason: v.reason });
      continue;
    }
    if (
      fileEntries.length >= MAX_ENTRIES &&
      !fileEntries.some((e) => e.value === item.value)
    ) {
      skipped.push({ value: item.value, reason: "blocklist full" });
      continue;
    }
    const entry: BlocklistEntry = {
      value: item.value,
      addedAt: now,
      addedBy,
      reason: item.reason ?? null,
      expiresAt: item.ttlMs && item.ttlMs > 0 ? now + item.ttlMs : null,
    };
    const idx = fileEntries.findIndex((e) => e.value === item.value);
    if (idx >= 0) fileEntries[idx] = entry;
    else fileEntries.push(entry);
    added++;
  }

  if (added > 0) {
    await writeToDisk(fileEntries);
    logger.info("blocklist bulk_add", {
      event: "blocklist_change",
      action: "bulk_add",
      addedBy,
      added,
      skipped: skipped.length,
    });
  }

  return { added, skipped };
}

export function listEntries(): {
  entries: BlocklistEntry[];
  envSeed: string[];
} {
  const now = Date.now();
  const live = fileEntries.filter(
    (e) => e.expiresAt === null || e.expiresAt > now,
  );
  return { entries: live, envSeed: [...envSeed] };
}

// ---------- TTL cleanup ----------

export function startTtlCleanup(): void {
  setInterval(async () => {
    const now = Date.now();
    const live = fileEntries.filter(
      (e) => e.expiresAt === null || e.expiresAt > now,
    );
    if (live.length === fileEntries.length) return;
    const expired = fileEntries.length - live.length;
    fileEntries = live;
    try {
      await writeToDisk(fileEntries);
      logger.info("blocklist ttl cleanup", {
        event: "blocklist_change",
        action: "ttl_cleanup",
        expired,
      });
    } catch (e) {
      logger.error("blocklist ttl cleanup write failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, CLEANUP_INTERVAL_MS);
}
