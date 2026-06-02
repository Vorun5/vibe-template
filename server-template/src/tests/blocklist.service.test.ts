/**
 * Unit tests for blocklist.service.
 *
 * Tests are NOT read-only — they create a temporary directory and write a
 * scratch blocklist.json there. Each test mutates `process.env.DATA_ROOT`
 * BEFORE importing the service so that the module-load constants pick up
 * the test path. Use `bun test --rerun-each` is NOT required; module is
 * imported fresh per process.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// Set the DATA_ROOT before importing the service. The service computes the
// blocklist file path at module load time.
const TMP_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), "blocklist-test-"));
process.env.DATA_ROOT = TMP_ROOT;
// Use 3-octet form to express a /24 prefix (full 4-octet is exact-match).
process.env.IP_BLOCKLIST = "203.0.113,198.51.100.42";
process.env.RATE_LIMIT_TRUSTED_PROXIES = "127.0.0.1,10.0.0.1";
process.env.INTERNAL_ALLOWED_IPS = "10.0.0.2";

const {
  addEntry,
  removeEntry,
  bulkAdd,
  listEntries,
  isBlocked,
  validateValue,
  loadFromDisk,
} = await import("@/services/blocklist.service");

beforeAll(async () => {
  await loadFromDisk();
});

afterAll(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
});

// ============================================================
// validateValue
// ============================================================

describe("validateValue", () => {
  it("accepts a full 4-octet IPv4", () => {
    expect(validateValue("1.2.3.4")).toEqual({ ok: true });
  });

  it("accepts a 3-octet /24 prefix", () => {
    expect(validateValue("1.2.3")).toEqual({ ok: true });
  });

  it("rejects 1-octet input", () => {
    const r = validateValue("1");
    expect(r.ok).toBe(false);
  });

  it("rejects 5-octet input", () => {
    const r = validateValue("1.2.3.4.5");
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range octet 256", () => {
    const r = validateValue("1.2.3.256");
    expect(r.ok).toBe(false);
  });

  it("rejects non-numeric octet", () => {
    const r = validateValue("1.2.abc.4");
    expect(r.ok).toBe(false);
  });

  it("rejects empty string", () => {
    const r = validateValue("");
    expect(r.ok).toBe(false);
  });

  it("rejects banning a trusted proxy", () => {
    const r = validateValue("127.0.0.1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/infrastructure/i);
  });

  it("rejects banning an internal allowed IP", () => {
    const r = validateValue("10.0.0.2");
    expect(r.ok).toBe(false);
  });

  it("rejects banning a private RFC1918 host /32", () => {
    const r = validateValue("192.168.1.50");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/private/i);
  });

  it("allows a 3-octet private prefix (decision left to admin)", () => {
    // The guard only kicks in for full 4-octet private addresses — a /24
    // prefix is allowed because callers explicitly opted into it.
    expect(validateValue("192.168.1").ok).toBe(true);
  });
});

// ============================================================
// isBlocked (env seed + file entries)
// ============================================================

describe("isBlocked — env seed", () => {
  it("blocks IP matching env /24 prefix 203.0.113.x", () => {
    expect(isBlocked("203.0.113.5")).toBe(true);
    expect(isBlocked("203.0.113.255")).toBe(true);
  });

  it("does not over-match prefix (1.2.3 does NOT match 1.2.30.4)", () => {
    // sanity for the `rule + "."` startsWith logic. 203.0.113 should not
    // accidentally match 203.0.1130.x etc.
    expect(isBlocked("203.0.1130.5")).toBe(false);
  });

  it("blocks exact 4-octet env entry", () => {
    expect(isBlocked("198.51.100.42")).toBe(true);
  });

  it("does NOT block neighbours of an exact env entry", () => {
    expect(isBlocked("198.51.100.43")).toBe(false);
  });

  it("does not block random unrelated IPs", () => {
    expect(isBlocked("8.8.8.8")).toBe(false);
  });
});

// ============================================================
// addEntry / removeEntry
// ============================================================

describe("addEntry", () => {
  it("adds a valid entry and persists to disk", async () => {
    const result = await addEntry({
      value: "5.6.7.8",
      addedBy: "test",
      reason: "abuse",
    });
    expect(result.ok).toBe(true);
    expect(isBlocked("5.6.7.8")).toBe(true);

    // Verify on-disk persistence
    const raw = await fs.readFile(path.join(TMP_ROOT, "blocklist.json"), "utf8");
    expect(raw).toContain("5.6.7.8");
  });

  it("rejects an infrastructure IP", async () => {
    const result = await addEntry({
      value: "127.0.0.1",
      addedBy: "test",
    });
    expect(result.ok).toBe(false);
  });

  it("addEntry is idempotent — re-adding refreshes the entry", async () => {
    await addEntry({ value: "9.9.9.9", addedBy: "first", reason: "r1" });
    await addEntry({ value: "9.9.9.9", addedBy: "second", reason: "r2" });
    const { entries } = listEntries();
    const matches = entries.filter((e) => e.value === "9.9.9.9");
    expect(matches.length).toBe(1);
    expect(matches[0].addedBy).toBe("second");
    expect(matches[0].reason).toBe("r2");
  });

  it("respects ttlMs (entry expires)", async () => {
    await addEntry({
      value: "11.11.11.11",
      addedBy: "test",
      ttlMs: 50,
    });
    expect(isBlocked("11.11.11.11")).toBe(true);
    await new Promise((r) => setTimeout(r, 80));
    expect(isBlocked("11.11.11.11")).toBe(false);
  });
});

describe("removeEntry", () => {
  it("removes an existing entry", async () => {
    await addEntry({ value: "12.12.12.12", addedBy: "test" });
    expect(isBlocked("12.12.12.12")).toBe(true);
    const { removed } = await removeEntry("12.12.12.12");
    expect(removed).toBe(true);
    expect(isBlocked("12.12.12.12")).toBe(false);
  });

  it("returns removed=false for unknown value", async () => {
    const { removed } = await removeEntry("99.99.99.99");
    expect(removed).toBe(false);
  });

  it("removeEntry does NOT touch the env seed", async () => {
    const before = isBlocked("198.51.100.42");
    const { removed } = await removeEntry("198.51.100.42");
    expect(removed).toBe(false);
    const after = isBlocked("198.51.100.42");
    expect(before).toBe(true);
    expect(after).toBe(true); // env seed still blocking
  });
});

// ============================================================
// bulkAdd
// ============================================================

describe("bulkAdd", () => {
  it("returns counts of added and skipped", async () => {
    const result = await bulkAdd(
      [
        { value: "21.0.0.1" },
        { value: "127.0.0.1" }, // skipped (infra)
        { value: "21.0.0.2" },
        { value: "bad" }, // skipped (invalid)
      ],
      "bulk-tester",
    );
    expect(result.added).toBe(2);
    expect(result.skipped.length).toBe(2);
    expect(isBlocked("21.0.0.1")).toBe(true);
    expect(isBlocked("21.0.0.2")).toBe(true);
  });
});

// ============================================================
// listEntries
// ============================================================

describe("listEntries", () => {
  it("returns env seed separately from file entries", () => {
    const data = listEntries();
    expect(data.envSeed).toContain("203.0.113");
    expect(data.envSeed).toContain("198.51.100.42");
    // file entries are dynamic — just assert shape
    expect(Array.isArray(data.entries)).toBe(true);
    for (const e of data.entries) {
      expect(typeof e.value).toBe("string");
      expect(typeof e.addedAt).toBe("number");
      expect(typeof e.addedBy).toBe("string");
      expect(e.reason === null || typeof e.reason === "string").toBe(true);
      expect(e.expiresAt === null || typeof e.expiresAt === "number").toBe(true);
    }
  });

  it("filters expired entries from list at read time", async () => {
    await addEntry({
      value: "31.31.31.31",
      addedBy: "ttl-test",
      ttlMs: 30,
    });
    await new Promise((r) => setTimeout(r, 60));
    const { entries } = listEntries();
    expect(entries.some((e) => e.value === "31.31.31.31")).toBe(false);
  });
});
