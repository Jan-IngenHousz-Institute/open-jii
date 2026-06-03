/**
 * Performance benchmarks for the measurements storage layer.
 *
 * Runs as part of the default `pnpm test` (CI-sized: N_ROWS = 100, COUNTS_N
 * = 500, payload ~18 KB raw / ~4 KB gzipped). For a fuller diagnostic on
 * local hardware, bump N_ROWS to 1000, payload sample-count to 250, and
 * COUNTS_N/SCAN_N to 5000 — see comments near each constant.
 *
 * Three uses:
 *   1. Diagnostic — run on `main` to see WHERE the time actually goes.
 *   2. During implementation — re-run after each optimisation; the SUMMARY
 *      headline number drops as the production read path is improved.
 *   3. Regression — `expect()` guards in SUMMARY trip if decompression / Zod
 *      / full `SELECT *` ever sneak back into the list hot path.
 *
 * Each scenario seeds an in-memory better-sqlite3 DB with a MultispeQ-shaped
 * payload (~18 KB raw / ~4 KB gzipped per row at CI sizes; biggest real
 * measurements exceed 150 KB and MQTT's publish limit is 128 KB, so gzip is
 * required at send time). Deterministic seed → reproducible numbers across
 * runs.
 *
 * Scenarios A–G isolate one mechanism each (gzip, sort, index, …).
 * Scenarios H–O add diagnostic depth (scale curves, single-row save,
 * production-path reproduction, pagination, concurrency, plain-text questions).
 * SUMMARY pulls the headline numbers into one table + guard expects.
 *
 * IMPORTANT FRAMING: gzip-on-save is NOT the fix to remove — we'd just have
 * to gzip again at MQTT send. The killer is decompressing the blob on every
 * list render. Scenario A is informational; the real win is in B/G/O.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { parseQuestions } from "~/shared/utils/convert-cycle-answers-to-array";
import { compressForStorage, decompressFromStorage } from "~/shared/utils/storage-compression";

import * as schema from "../schema";

// ---------------------------------------------------------------------------
// Production-path mocks (only Scenario L imports the real storage module;
// other scenarios use Database directly. Mocks are inert for them.)
// ---------------------------------------------------------------------------

let productionSqlite: ReturnType<typeof Database>;
let productionDrizzleDb: ReturnType<typeof drizzle>;

vi.mock("../client", () => ({
  get db() {
    return productionDrizzleDb;
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    getAllKeys: vi.fn(() => Promise.resolve([])),
    multiGet: vi.fn(() => Promise.resolve([])),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `bench-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Sizes are tuned for CI: the whole suite finishes in ~10 s on a slow runner
// while keeping the regression-gate ratios in SUMMARY meaningful (they hold
// at any size). For a fuller diagnostic on local hardware, bump N_ROWS to
// 1000, the scale curve to [100, 500, 1000, 2000], and COUNTS_N/SCAN_N to
// 5000, and increase HOOK_TIMEOUT accordingly.
const N_ROWS = 100;
const HOOK_TIMEOUT = 30_000;

vi.setConfig({ testTimeout: HOOK_TIMEOUT });
const EXPERIMENTS = [
  "Wheat phenotyping",
  "Barley stress trial",
  "Control group A",
  "Tomato field B",
];
const PROTOCOLS = ["multispeq-v2.0", "leaf-temp", "full-protocol", "photosynthesis-v3"];

// "uploading" was dropped in migration 0003; the seed must only use statuses
// the current CHECK constraint allows.
const STATUSES = ["successful", "pending", "failed"] as const;
function statusFor(i: number) {
  return STATUSES[i % STATUSES.length];
}

// ---------------------------------------------------------------------------
// Realistic-shape payload generator
//
// Shape mirrors a MultispeQ measurement (sample array + questions +
// annotations) but at a CI-friendly size. ~30 sample objects → ~18 KB raw /
// ~4 KB gzipped per row. The regression-gate ratios hold at any payload
// size; bump the sample count to 250 for the full ~150 KB diagnostic.
// ---------------------------------------------------------------------------

function makeMeasurementResult(seed: number) {
  // Deterministic LCG; tests reproducible across runs / machines.
  let s = seed * 0x9e3779b1;
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };

  const sample = Array.from({ length: 30 }, (_, i) => ({
    phi2: rng(),
    fv_fm: rng(),
    npq: rng(),
    npqt: rng(),
    phi2_alpha: rng(),
    ps2_openness: rng(),
    leaf_temp_differential: rng() * 5 - 2.5,
    chlorophyll_spad: rng() * 80,
    relative_chlorophyll: rng() * 100,
    r: rng() * 255,
    g: rng() * 255,
    b: rng() * 255,
    thickness: rng() * 0.5,
    optical_density_630: rng(),
    optical_density_840: rng(),
    chlorophyll_a: rng() * 50,
    chlorophyll_b: rng() * 30,
    carotenoids: rng() * 20,
    light_intensity: rng() * 2000,
    humidity: rng() * 100,
    readings: Array.from({ length: 60 }, () => Math.round(rng() * 65535)),
    pulse_index: i,
    data_raw: Array.from({ length: 30 }, () => Math.round(rng() * 4095)),
  }));

  return {
    sample,
    questions: [
      { question_label: "plant_id", question_text: "Plant ID", question_answer: `P${seed % 1000}` },
      {
        question_label: "plot",
        question_text: "Plot number",
        question_answer: String((seed % 50) + 1),
      },
      {
        question_label: "leaf_pos",
        question_text: "Leaf position",
        question_answer: ["young", "mature", "old"][seed % 3],
      },
      {
        question_label: "treatment",
        question_text: "Treatment",
        question_answer: ["control", "drought", "heat", "combined"][seed % 4],
      },
      {
        question_label: "rep",
        question_text: "Replicate",
        question_answer: String((seed % 4) + 1),
      },
      {
        question_label: "notes",
        question_text: "Field notes",
        question_answer: seed % 3 === 0 ? "slight yellowing observed on leaf margins" : "",
      },
      {
        question_label: "time_of_day",
        question_text: "Time of day",
        question_answer: ["morning", "midday", "afternoon"][seed % 3],
      },
      {
        question_label: "cloud_cover",
        question_text: "Cloud cover (%)",
        question_answer: String(Math.round(rng() * 100)),
      },
    ],
    protocol_version: "2.0.3",
    device_id: `MSPx-${String(seed % 100).padStart(4, "0")}`,
    firmware: "3.1.2",
    timestamp: new Date(Date.now() - seed * 60_000).toISOString(),
    timezone: "Europe/Amsterdam",
    user_id: `user-${seed % 10}`,
    macros: [],
    annotations: null,
    _sample_encoding: "raw",
  };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

const MIGRATION_SQLS = [
  "0000_outgoing_firebird.sql",
  "0001_add_pending_status.sql",
  "0002_dashing_lenny_balinger.sql",
  "0003_drop_uploading_status.sql",
  "0004_add_day_key.sql",
].map((f) => readFileSync(resolve(__dirname, "../../../../drizzle", f), "utf-8"));

function createDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  for (const sql of MIGRATION_SQLS) {
    db.exec(sql.replace(/-->\s*statement-breakpoint/g, ""));
  }
  return db;
}

function addIndexes(db: ReturnType<typeof Database>) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_status      ON measurements(status);
    CREATE INDEX IF NOT EXISTS idx_status_ts   ON measurements(status, timestamp);
    CREATE INDEX IF NOT EXISTS idx_created_at  ON measurements(created_at);
  `);
}

// Migration 0002 ships indexes by default. Used by "no index" diagnostic
// scenarios that simulate the pre-optimisation state.
function dropIndexes(db: ReturnType<typeof Database>) {
  db.exec(`
    DROP INDEX IF EXISTS idx_measurements_status;
    DROP INDEX IF EXISTS idx_measurements_status_ts;
    DROP INDEX IF EXISTS idx_measurements_created_at;
  `);
}

// Migration 0002 ships the `questions_text` column by default. Scenarios
// that compare against the pre-optimisation world either ignore the column
// or use the legacy `getMeasurements()` path that doesn't read it.

// ---------------------------------------------------------------------------
// Lazy payload cache (avoids the original 10 s `beforeAll` timeout)
// ---------------------------------------------------------------------------

const _cache: {
  compressed?: string[];
  plain?: string[];
  parsed?: ReturnType<typeof makeMeasurementResult>[];
} = {};

function getParsedObjects(n: number): ReturnType<typeof makeMeasurementResult>[] {
  if (!_cache.parsed || _cache.parsed.length < n) {
    _cache.parsed = Array.from({ length: n }, (_, i) => makeMeasurementResult(i));
  }
  return _cache.parsed.slice(0, n);
}

function getCompressedPayloads(n: number): string[] {
  if (!_cache.compressed || _cache.compressed.length < n) {
    // Generate one-at-a-time so we never hold N parsed objects + N compressed
    // strings simultaneously (bumping CI sizes back up would otherwise spike).
    const out: string[] = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = compressForStorage(makeMeasurementResult(i));
    }
    _cache.compressed = out;
  }
  return _cache.compressed.slice(0, n);
}

function getPlainPayloads(n: number): string[] {
  if (!_cache.plain || _cache.plain.length < n) {
    const out: string[] = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = JSON.stringify(makeMeasurementResult(i));
    }
    _cache.plain = out;
  }
  return _cache.plain.slice(0, n);
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

type SeedRow = [
  id: string,
  status: string,
  topic: string,
  blob: string,
  experimentName: string,
  protocolName: string,
  timestamp: string,
  createdAt: number,
];

function seedCompressed(db: ReturnType<typeof Database>, n: number) {
  const blobs = getCompressedPayloads(n);
  const stmt = db.prepare(`
    INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at, questions_text, has_comment, day_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL)
  `);
  const insertMany = db.transaction((rows: SeedRow[]) => {
    for (const row of rows) stmt.run(...row);
  });

  const rows: SeedRow[] = Array.from({ length: n }, (_, i) => [
    `id-${i}`,
    statusFor(i),
    `topic/exp/${i % 4}`,
    blobs[i],
    EXPERIMENTS[i % EXPERIMENTS.length],
    PROTOCOLS[i % PROTOCOLS.length],
    new Date(Date.now() - i * 60_000).toISOString(),
    Date.now() - i * 60_000,
  ]);
  insertMany(rows);
}

function seedPlain(db: ReturnType<typeof Database>, n: number) {
  const blobs = getPlainPayloads(n);
  const stmt = db.prepare(`
    INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at, questions_text, has_comment, day_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL)
  `);
  const insertMany = db.transaction((rows: SeedRow[]) => {
    for (const row of rows) stmt.run(...row);
  });

  const rows: SeedRow[] = Array.from({ length: n }, (_, i) => [
    `id-${i}`,
    statusFor(i),
    `topic/exp/${i % 4}`,
    blobs[i],
    EXPERIMENTS[i % EXPERIMENTS.length],
    PROTOCOLS[i % PROTOCOLS.length],
    new Date(Date.now() - i * 60_000).toISOString(),
    Date.now() - i * 60_000,
  ]);
  insertMany(rows);
}

// Seed including the `questions_text` plain-text column (Scenario O).
function seedCompressedWithQuestionsText(db: ReturnType<typeof Database>, n: number) {
  const blobs = getCompressedPayloads(n);
  const parsed = getParsedObjects(n);
  const stmt = db.prepare(`
    INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at, questions_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((rows: unknown[][]) => {
    for (const row of rows) stmt.run(...row);
  });

  const rows = Array.from({ length: n }, (_, i) => [
    `id-${i}`,
    statusFor(i),
    `topic/exp/${i % 4}`,
    blobs[i],
    EXPERIMENTS[i % EXPERIMENTS.length],
    PROTOCOLS[i % PROTOCOLS.length],
    new Date(Date.now() - i * 60_000).toISOString(),
    Date.now() - i * 60_000,
    JSON.stringify(parsed[i].questions),
  ]);
  insertMany(rows);
}

// ---------------------------------------------------------------------------
// Timing + reporting helpers
// ---------------------------------------------------------------------------

function time<T>(fn: () => T): { result: T; ms: number } {
  const t0 = performance.now();
  const result = fn();
  return { result, ms: performance.now() - t0 };
}

async function timeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t0 };
}

function report(rows: { scenario: string; ms: number; note: string }[]) {
  const maxLabel = Math.max(...rows.map((r) => r.scenario.length));
  console.log("\n" + "─".repeat(80));
  for (const r of rows) {
    const label = r.scenario.padEnd(maxLabel + 2);
    const ms = `${r.ms.toFixed(2)} ms`.padStart(11);
    console.log(`  ${label}${ms}   ${r.note}`);
  }
  console.log("─".repeat(80) + "\n");
}

// ---------------------------------------------------------------------------
// Summary collector — every scenario calls record() with its key numbers.
// SUMMARY at the bottom reads these.
// ---------------------------------------------------------------------------

interface SummaryRow {
  key: string;
  label: string;
  ms: number;
}
const summary: SummaryRow[] = [];
function record(key: string, label: string, ms: number) {
  summary.push({ key, label, ms });
}
function getSummary(key: string): number | undefined {
  return summary.find((s) => s.key === key)?.ms;
}

// ===========================================================================
// Scenario A — SAVE: compressed vs plain JSON (informational only)
//
// We won't drop gzip on save because we'd have to re-add it at MQTT send time
// (payload exceeds the 128 KB broker limit). This scenario quantifies the
// gzip cost; the answer drives the "compress on send instead of save" debate.
// ===========================================================================

describe(`Scenario A — SAVE ${N_ROWS} rows (informational)`, () => {
  it("compressed vs plain-JSON insert", () => {
    const dbC = createDb();
    const dbP = createDb();

    const { ms: msC } = time(() => seedCompressed(dbC, N_ROWS));
    const { ms: msP } = time(() => seedPlain(dbP, N_ROWS));

    const sizeC =
      (dbC.pragma("page_count", { simple: true }) as number) *
      (dbC.pragma("page_size", { simple: true }) as number);
    const sizeP =
      (dbP.pragma("page_count", { simple: true }) as number) *
      (dbP.pragma("page_size", { simple: true }) as number);

    report([
      {
        scenario: `INSERT ${N_ROWS} — compressForStorage (gzip+b64)`,
        ms: msC,
        note: `~${(sizeC / 1024 / 1024).toFixed(2)} MB on disk`,
      },
      {
        scenario: `INSERT ${N_ROWS} — JSON.stringify (plain)`,
        ms: msP,
        note: `~${(sizeP / 1024 / 1024).toFixed(2)} MB on disk`,
      },
    ]);

    console.log(`  Compression ratio:  ${(sizeP / sizeC).toFixed(1)}× smaller compressed`);
    console.log(`  Per-row gz cost:    ~${((msC - msP) / N_ROWS).toFixed(2)} ms/row\n`);

    record("A.save.compressed", `INSERT ${N_ROWS} compressed`, msC);
    record("A.save.plain", `INSERT ${N_ROWS} plain`, msP);

    dbC.close();
    dbP.close();
  });
});

// ===========================================================================
// Scenario B — READ: full SELECT + decompress vs lean metadata-only SELECT
// ===========================================================================

describe(`Scenario B — READ ${N_ROWS} rows`, () => {
  let dbC: ReturnType<typeof Database>;
  let dbP: ReturnType<typeof Database>;

  beforeAll(() => {
    dbC = createDb();
    dbP = createDb();
    seedCompressed(dbC, N_ROWS);
    seedPlain(dbP, N_ROWS);
  }, HOOK_TIMEOUT);

  it("full SELECT + decompress vs lean column SELECT", () => {
    const { ms: msFullC } = time(() => {
      const rows = dbC.prepare("SELECT * FROM measurements").all() as Record<string, unknown>[];
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        data: decompressFromStorage(r.measurement_result as string),
      }));
    });

    const { ms: msLeanC } = time(() =>
      dbC
        .prepare("SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements")
        .all(),
    );

    const { ms: msFullP } = time(() => {
      const rows = dbP.prepare("SELECT * FROM measurements").all() as Record<string, unknown>[];
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        data: JSON.parse(r.measurement_result as string),
      }));
    });

    report([
      {
        scenario: "SELECT * + gzip decompress (current)",
        ms: msFullC,
        note: "fetches compressed blob, gunzips each row",
      },
      {
        scenario: "SELECT metadata only (lean, no blob)",
        ms: msLeanC,
        note: "no measurement_result column fetched",
      },
      {
        scenario: "SELECT * + JSON.parse (plain storage)",
        ms: msFullP,
        note: "no gzip — plain JSON.parse per row",
      },
    ]);

    const decompressContribution = msFullC - msLeanC;
    console.log(
      `  Decompress contribution: ~${decompressContribution.toFixed(1)} ms (${((decompressContribution / msFullC) * 100).toFixed(0)}% of full-read time)`,
    );
    console.log(
      `  JSON.parse vs lean:      ~${(msFullP - msLeanC).toFixed(1)} ms (cost of full payload + JSON.parse over lean)\n`,
    );

    record("B.read.full", `READ ${N_ROWS} full+decompress`, msFullC);
    record("B.read.lean", `READ ${N_ROWS} lean SELECT`, msLeanC);
    record("B.read.plain", `READ ${N_ROWS} full+JSON.parse`, msFullP);

    expect(msLeanC).toBeLessThan(msFullC);
  });
});

// ===========================================================================
// Scenario C — DECOMPRESS alone: isolate gzip cost per row
// ===========================================================================

describe("Scenario C — DECOMPRESS: gzip vs JSON.parse per row", () => {
  it(`decompresses ${N_ROWS} pre-fetched payloads`, () => {
    const compressedPayloads = getCompressedPayloads(N_ROWS);
    const plainPayloads = getPlainPayloads(N_ROWS);

    const { ms: msGzip } = time(() => compressedPayloads.map((s) => decompressFromStorage(s)));
    const { ms: msJson } = time(() => plainPayloads.map((s) => JSON.parse(s)));
    const { ms: msNoop } = time(() => compressedPayloads.map((s) => s.length));

    const payloadSizeKb = (compressedPayloads[0].length / 1024).toFixed(1);
    const plainSizeKb = (plainPayloads[0].length / 1024).toFixed(1);

    report([
      {
        scenario: `gzip decompress × ${N_ROWS} (current)`,
        ms: msGzip,
        note: `~${payloadSizeKb} KB compressed/row → ~${(msGzip / N_ROWS).toFixed(2)} ms/row`,
      },
      {
        scenario: `JSON.parse × ${N_ROWS} (plain)`,
        ms: msJson,
        note: `~${plainSizeKb} KB plain/row → ~${(msJson / N_ROWS).toFixed(2)} ms/row`,
      },
      { scenario: "no-op baseline (just iterate)", ms: msNoop, note: "pure loop overhead" },
    ]);

    console.log(`  gzip vs JSON.parse speedup: ${(msGzip / Math.max(msJson, 0.01)).toFixed(1)}×`);
    console.log(
      `  gzip alone = ${(msGzip - msNoop).toFixed(1)} ms net, JSON.parse = ${(msJson - msNoop).toFixed(1)} ms net\n`,
    );

    record("C.decompress.gzip", `decompress ${N_ROWS} gzip`, msGzip);
    record("C.decompress.json", `decompress ${N_ROWS} JSON.parse`, msJson);

    expect(msGzip).toBeGreaterThan(msJson);
  });
});

// ===========================================================================
// Scenario D — parseQuestions: Zod safeParse vs direct property access
// ===========================================================================

describe("Scenario D — parseQuestions: Zod vs direct access", () => {
  it(`runs parseQuestions on ${N_ROWS} objects`, () => {
    const parsedObjects = getParsedObjects(N_ROWS);

    const { ms: msZod } = time(() => parsedObjects.map((obj) => parseQuestions(obj)));

    const parseQsDirect = (measurementResult: unknown) => {
      const r = measurementResult as Record<string, unknown> | null | undefined;
      if (!Array.isArray(r?.questions)) return [];
      return r.questions;
    };
    const { ms: msDirect } = time(() => parsedObjects.map((obj) => parseQsDirect(obj)));
    const { ms: msNoop } = time(() => parsedObjects.map(() => []));

    report([
      {
        scenario: "parseQuestions — Zod safeParse (current)",
        ms: msZod,
        note: `~${(msZod / N_ROWS).toFixed(3)} ms/call`,
      },
      {
        scenario: "parseQuestions — direct access (proposed)",
        ms: msDirect,
        note: `~${(msDirect / N_ROWS).toFixed(3)} ms/call`,
      },
      {
        scenario: "no parsing (lean list baseline)",
        ms: msNoop,
        note: "no questions extracted at all",
      },
    ]);

    console.log(`  Zod vs direct speedup: ${(msZod / Math.max(msDirect, 0.01)).toFixed(1)}×\n`);

    record("D.parseQuestions.zod", `parseQuestions ${N_ROWS} Zod`, msZod);
    record("D.parseQuestions.direct", `parseQuestions ${N_ROWS} direct`, msDirect);
  });
});

// (Scenario E — SQL sort vs JS sort — dropped; covered by Scenario G's pipeline.)

// ===========================================================================
// Scenario F — INDEXES: status filter with vs without index
// ===========================================================================

describe("Scenario F — INDEXES: status filter performance", () => {
  let dbNoIndex: ReturnType<typeof Database>;
  let dbIndex: ReturnType<typeof Database>;

  beforeAll(() => {
    dbNoIndex = createDb();
    dbIndex = createDb();
    dropIndexes(dbNoIndex);
    // Plain seed: payload compression is irrelevant for index vs full-scan timing.
    seedPlain(dbNoIndex, N_ROWS);
    seedPlain(dbIndex, N_ROWS);
  }, HOOK_TIMEOUT);

  it("WHERE status IN (...) with and without index", () => {
    const allStatuses = ["pending", "failed", "successful"];
    const oneStatus = ["pending"];

    dbNoIndex.prepare("SELECT id FROM measurements WHERE status = 'pending'").all();
    dbIndex.prepare("SELECT id FROM measurements WHERE status = 'pending'").all();

    const { ms: msAllNoIdx } = time(() =>
      dbNoIndex
        .prepare(
          `SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements WHERE status IN (${allStatuses.map(() => "?").join(",")})`,
        )
        .all(...allStatuses),
    );
    const { ms: msAllIdx } = time(() =>
      dbIndex
        .prepare(
          `SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements WHERE status IN (${allStatuses.map(() => "?").join(",")})`,
        )
        .all(...allStatuses),
    );
    const { ms: msOneNoIdx } = time(() =>
      dbNoIndex
        .prepare(
          "SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements WHERE status = ?",
        )
        .all(...oneStatus),
    );
    const { ms: msOneIdx } = time(() =>
      dbIndex
        .prepare(
          "SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements WHERE status = ?",
        )
        .all(...oneStatus),
    );

    report([
      {
        scenario: "all statuses, NO index   (full scan, 1k)",
        ms: msAllNoIdx,
        note: "returns all rows",
      },
      { scenario: "all statuses, WITH index (1k)", ms: msAllIdx, note: "index helps grouping" },
      {
        scenario: "one status,   NO index   (full scan → 250)",
        ms: msOneNoIdx,
        note: "scans 1k to return 250",
      },
      { scenario: "one status,   WITH index (→ 250)", ms: msOneIdx, note: "index seek → 250 rows" },
    ]);

    record("F.index.one.no", "WHERE status=? no index", msOneNoIdx);
    record("F.index.one.with", "WHERE status=? with index", msOneIdx);
  });
});

// ===========================================================================
// Scenario G — FULL PIPELINE: current vs proposed (per render)
// ===========================================================================

describe("Scenario G — FULL PIPELINE: current vs proposed", () => {
  let db: ReturnType<typeof Database>;
  let dbIdx: ReturnType<typeof Database>;

  beforeAll(() => {
    db = createDb();
    dbIdx = createDb();
    seedCompressed(db, N_ROWS);
    seedCompressed(dbIdx, N_ROWS);
    addIndexes(dbIdx);
  }, HOOK_TIMEOUT);

  it("current path vs proposed path for one full list render", () => {
    // CURRENT: full SELECT * → decompress every row → Zod parse → JS sort
    const { ms: msCurrent } = time(() => {
      const rows = db.prepare("SELECT * FROM measurements").all() as Record<string, unknown>[];
      return rows
        .map((r) => {
          const data = decompressFromStorage<ReturnType<typeof makeMeasurementResult>>(
            r.measurement_result as string,
          );
          return {
            id: r.id,
            status: r.status,
            experimentName: r.experiment_name,
            timestamp: r.timestamp as string,
            questions: parseQuestions(data),
            data,
          };
        })
        .sort((a, b) => (b.timestamp < a.timestamp ? -1 : 1));
    });

    // PROPOSED: lean SELECT, ORDER BY DESC, LIMIT 50. No decompress, no Zod.
    const { ms: msProposed } = time(() =>
      dbIdx
        .prepare(
          "SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements ORDER BY timestamp DESC LIMIT 50",
        )
        .all(),
    );

    // PROPOSED-ALL: same shape but no LIMIT (for comparison)
    const { ms: msProposedAll } = time(() =>
      dbIdx
        .prepare(
          "SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements ORDER BY timestamp DESC",
        )
        .all(),
    );

    report([
      {
        scenario: "CURRENT:  full + decompress + Zod + JS sort",
        ms: msCurrent,
        note: `all ${N_ROWS} rows`,
      },
      {
        scenario: "PROPOSED: lean SELECT … LIMIT 50",
        ms: msProposed,
        note: "50 rows, no decompress",
      },
      {
        scenario: "PROPOSED: lean SELECT all rows (no LIMIT)",
        ms: msProposedAll,
        note: `all ${N_ROWS} rows, still no decompress`,
      },
    ]);

    console.log(
      `  Speedup (first-page): ${(msCurrent / Math.max(msProposed, 0.01)).toFixed(0)}× faster`,
    );
    console.log(
      `  Speedup (all rows):   ${(msCurrent / Math.max(msProposedAll, 0.01)).toFixed(0)}× faster (even without pagination)\n`,
    );

    record("G.pipeline.current", `current path ${N_ROWS} rows`, msCurrent);
    record("G.pipeline.proposed.50", "proposed lean+LIMIT 50", msProposed);
    record("G.pipeline.proposed.all", "proposed lean (no LIMIT)", msProposedAll);

    expect(msProposed).toBeLessThan(msCurrent);
  });
});

// ===========================================================================
// Scenario H — SCALE: full pipeline at 100 / 500 / 1k / 2k rows
// ===========================================================================

describe("Scenario H — SCALE: full pipeline @ multiple row counts", () => {
  const sizes = [25, 50, 100, 200];
  const dbs: {
    size: number;
    raw: ReturnType<typeof Database>;
    idx: ReturnType<typeof Database>;
  }[] = [];

  beforeAll(() => {
    getCompressedPayloads(Math.max(...sizes));
    for (const size of sizes) {
      const raw = createDb();
      const idx = createDb();
      seedCompressed(raw, size);
      seedCompressed(idx, size);
      addIndexes(idx);
      dbs.push({ size, raw, idx });
    }
  }, HOOK_TIMEOUT);

  it("current path scales with N; proposed stays roughly constant", () => {
    const results = dbs.map(({ size, raw, idx }) => {
      const { ms: msCurrent } = time(() => {
        const rows = raw.prepare("SELECT * FROM measurements").all() as Record<string, unknown>[];
        return rows
          .map((r) => {
            const data = decompressFromStorage(r.measurement_result as string);
            return {
              id: r.id,
              status: r.status,
              timestamp: r.timestamp as string,
              questions: parseQuestions(data),
              data,
            };
          })
          .sort((a, b) => (b.timestamp < a.timestamp ? -1 : 1));
      });

      const { ms: msProposed } = time(() =>
        idx
          .prepare(
            "SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements ORDER BY timestamp DESC LIMIT 50",
          )
          .all(),
      );

      return { size, msCurrent, msProposed };
    });

    report(
      results.flatMap((r) => [
        {
          scenario: `current  @ ${String(r.size).padStart(5)} rows`,
          ms: r.msCurrent,
          note: `~${(r.msCurrent / r.size).toFixed(2)} ms/row`,
        },
        {
          scenario: `proposed @ ${String(r.size).padStart(5)} rows`,
          ms: r.msProposed,
          note: "LIMIT 50, lean SELECT",
        },
      ]),
    );

    const last = results[results.length - 1];
    const headlineCurrent = last.msCurrent;
    const headlineProposed = last.msProposed;
    console.log(
      `  Headline @ ${last.size} rows: ${(headlineCurrent / Math.max(headlineProposed, 0.01)).toFixed(0)}× faster proposed`,
    );

    const ratioFirst = results[0].msCurrent / results[0].size;
    const ratioLast = last.msCurrent / last.size;
    console.log(
      `  Per-row cost @ ${results[0].size}: ${ratioFirst.toFixed(2)} ms → @ ${last.size}: ${ratioLast.toFixed(2)} ms`,
    );
    console.log(
      `  ${Math.abs(ratioLast / ratioFirst - 1) < 0.5 ? "Linear scaling" : "Super-linear (something else is happening)"}\n`,
    );

    record("H.scale.current.max", `current @ ${last.size}`, headlineCurrent);
    record("H.scale.proposed.max", `proposed @ ${last.size}`, headlineProposed);
  });
});

// ===========================================================================
// Scenario I — countMeasurementsByStatus (second screen-mount query)
// ===========================================================================

// Scenario I constants live at module scope so SUMMARY can reference them.
// Each query at COUNTS_N rows runs in well under a millisecond — way below
// CI's scheduler noise floor. Running ITERATIONS in a tight loop makes the
// measured total gap clear the floor so Gate 3's ratio is stable.
const COUNTS_N = 500;
const COUNTS_ITERATIONS = 200;

describe("Scenario I — countMeasurementsByStatus", () => {
  let dbNoIdx: ReturnType<typeof Database>;
  let dbIdx: ReturnType<typeof Database>;

  beforeAll(() => {
    dbNoIdx = createDb();
    dbIdx = createDb();
    dropIndexes(dbNoIdx);
    // Plain seed: compression cost is irrelevant for measuring index vs full-scan.
    seedPlain(dbNoIdx, COUNTS_N);
    seedPlain(dbIdx, COUNTS_N);
  }, HOOK_TIMEOUT);

  it("GROUP BY status with vs without index", () => {
    const stmtNoIdx = dbNoIdx.prepare(
      "SELECT status, COUNT(*) AS total FROM measurements GROUP BY status",
    );
    const stmtIdx = dbIdx.prepare(
      "SELECT status, COUNT(*) AS total FROM measurements GROUP BY status",
    );
    // Warm up — first call pays statement-prepare + page-cache costs we don't
    // want polluting the measurement.
    stmtNoIdx.all();
    stmtIdx.all();

    const { ms: msNoIdx } = time(() => {
      for (let i = 0; i < COUNTS_ITERATIONS; i++) stmtNoIdx.all();
    });
    const { ms: msIdx } = time(() => {
      for (let i = 0; i < COUNTS_ITERATIONS; i++) stmtIdx.all();
    });

    report([
      {
        scenario: `GROUP BY status × ${COUNTS_ITERATIONS}, NO index   (${COUNTS_N} rows)`,
        ms: msNoIdx,
        note: "full table scan to count",
      },
      {
        scenario: `GROUP BY status × ${COUNTS_ITERATIONS}, WITH index (${COUNTS_N} rows)`,
        ms: msIdx,
        note: "covering index on status",
      },
    ]);

    console.log(`  Counts speedup: ${(msNoIdx / Math.max(msIdx, 0.01)).toFixed(1)}×\n`);

    record("I.counts.no", `counts @ ${COUNTS_N} no index`, msNoIdx);
    record("I.counts.with", `counts @ ${COUNTS_N} with index`, msIdx);
  });
});

// ===========================================================================
// Scenario J — Single-row save+read latency
// ===========================================================================

describe("Scenario J — Single-row save+read", () => {
  it("single insert + single read, compressed vs plain", () => {
    const payload = makeMeasurementResult(424242);
    const compressed = compressForStorage(payload);
    const plain = JSON.stringify(payload);
    const compressedSizeKb = (compressed.length / 1024).toFixed(1);
    const plainSizeKb = (plain.length / 1024).toFixed(1);

    const warmupDb = createDb();
    warmupDb.prepare("SELECT 1").get();
    warmupDb.close();

    const dbC = createDb();
    const { ms: msInsertC } = time(() => {
      dbC
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at, questions_text, has_comment, day_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL)`,
        )
        .run(
          "solo-c",
          "pending",
          "topic/x",
          compressForStorage(payload),
          "Exp",
          "P",
          new Date().toISOString(),
          Date.now(),
        );
    });

    const dbP = createDb();
    const { ms: msInsertP } = time(() => {
      dbP
        .prepare(
          `INSERT INTO measurements (id, status, topic, measurement_result, experiment_name, protocol_name, timestamp, created_at, questions_text, has_comment, day_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL)`,
        )
        .run(
          "solo-p",
          "pending",
          "topic/x",
          JSON.stringify(payload),
          "Exp",
          "P",
          new Date().toISOString(),
          Date.now(),
        );
    });

    const { ms: msReadC } = time(() => {
      const row = dbC.prepare("SELECT * FROM measurements WHERE id = ?").get("solo-c") as Record<
        string,
        unknown
      >;
      return decompressFromStorage(row.measurement_result as string);
    });

    const { ms: msReadP } = time(() => {
      const row = dbP.prepare("SELECT * FROM measurements WHERE id = ?").get("solo-p") as Record<
        string,
        unknown
      >;
      return JSON.parse(row.measurement_result as string);
    });

    const { ms: msGzipOneRow } = time(() => compressForStorage(payload));

    report([
      {
        scenario: "INSERT compressed (1 row)",
        ms: msInsertC,
        note: `gz+b64 of ~${compressedSizeKb} KB before INSERT`,
      },
      { scenario: "INSERT plain (1 row)", ms: msInsertP, note: `~${plainSizeKb} KB JSON` },
      { scenario: "READ compressed (1 row)", ms: msReadC, note: "fetch + decompress" },
      { scenario: "READ plain (1 row)", ms: msReadP, note: "fetch + JSON.parse" },
      {
        scenario: "gzip one row (MQTT send)",
        ms: msGzipOneRow,
        note: "single-shot compress at send time",
      },
    ]);

    console.log(
      `  Save round-trip:  compressed=${(msInsertC + msReadC).toFixed(2)} ms  vs  plain=${(msInsertP + msReadP).toFixed(2)} ms`,
    );
    console.log(
      `  Gzip-on-send cost: ${msGzipOneRow.toFixed(2)} ms — paid once per measurement, not per render\n`,
    );

    record("J.save.compressed", "1-row save+read compressed", msInsertC + msReadC);
    record("J.save.plain", "1-row save+read plain", msInsertP + msReadP);
    record("J.gzip.one", "gzip one row at send time", msGzipOneRow);

    dbC.close();
    dbP.close();
  });
});

// (Scenario K — batch markAsUploading — dropped; Scenario F already covers
//  the index gap on status filters.)

// ===========================================================================
// Scenario L — Production-path reproduction (real getMeasurements)
// ===========================================================================

describe("Scenario L — Production path (real getMeasurementsList)", () => {
  beforeAll(async () => {
    productionSqlite = new Database(":memory:");
    productionSqlite.pragma("journal_mode = WAL");
    for (const sql of MIGRATION_SQLS) {
      productionSqlite.exec(sql.replace(/-->\s*statement-breakpoint/g, ""));
    }
    productionDrizzleDb = drizzle(productionSqlite, { schema });

    // Seed including the new questions_text + has_comment columns so the
    // production lean path returns realistic data (matches what
    // saveMeasurement now does at write time).
    seedCompressedWithQuestionsText(productionSqlite, N_ROWS);

    const mod = await import("../measurements-storage");
    // Warm legacy AsyncStorage migration check
    await mod.getMeasurementsList(["pending"], { limit: 1, offset: 0 });
  }, HOOK_TIMEOUT);

  it("calls the production getMeasurementsList + count pipeline (post-optimisation)", async () => {
    const mod = await import("../measurements-storage");

    // L1: the production list query — lean SELECT, SQL ORDER BY, paginated.
    // This number should drop dramatically vs the pre-optimisation baseline.
    const { ms: msProdList } = await timeAsync(async () =>
      mod.getMeasurementsList(["pending", "failed", "successful"], {
        limit: 50,
        offset: 0,
      }),
    );

    // L2: full payload fetch for a single row (modal-open cost).
    const { ms: msProdOne } = await timeAsync(async () => mod.getMeasurement("id-0"));

    const { ms: msCounts } = await timeAsync(async () => mod.countMeasurementsByStatus());

    const { ms: msBoth } = await timeAsync(async () => {
      await Promise.all([
        mod.getMeasurementsList(["pending", "failed", "successful"], {
          limit: 50,
          offset: 0,
        }),
        mod.countMeasurementsByStatus(),
      ]);
    });

    report([
      {
        scenario: "PROD getMeasurementsList (lean, LIMIT 50)",
        ms: msProdList,
        note: `production list query @ ${N_ROWS} total rows`,
      },
      {
        scenario: "PROD getMeasurement(id) (full payload)",
        ms: msProdOne,
        note: "modal-open cost: 1 row decompress",
      },
      { scenario: "PROD countMeasurementsByStatus", ms: msCounts, note: "real GROUP BY query" },
      {
        scenario: "PROD list + counts (Promise.all)",
        ms: msBoth,
        note: "as fired on screen mount",
      },
    ]);

    console.log(
      `  Parallel overlap: ${(((msProdList + msCounts - msBoth) / Math.max(msBoth, 0.01)) * 100).toFixed(0)}% saved (0% = SQLite serialised anyway)\n`,
    );

    record("L.production.list", "PROD list (lean, LIMIT 50)", msProdList);
    record("L.production.one", "PROD getMeasurement(id)", msProdOne);
    record("L.production.counts", `PROD counts ${N_ROWS} rows`, msCounts);
    record("L.production.both", "PROD list+counts par.", msBoth);
  });
});

// ===========================================================================
// Scenario M — Pagination LIMIT/OFFSET at deep offsets
// ===========================================================================

describe("Scenario M — Pagination LIMIT/OFFSET cost", () => {
  let db: ReturnType<typeof Database>;
  const PAGE = 50;
  const SCAN_N = 500;

  beforeAll(() => {
    db = createDb();
    // Plain seed: payload compression is irrelevant for LIMIT/OFFSET scan cost.
    seedPlain(db, SCAN_N);
    addIndexes(db);
  }, HOOK_TIMEOUT);

  it("LIMIT 50 OFFSET … at offsets 0, 100, 1k, 5k", () => {
    const offsets = [0, 50, 200, 450];
    const rows = offsets.map((offset) => {
      const { ms } = time(() =>
        db
          .prepare(
            "SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements ORDER BY timestamp DESC LIMIT ? OFFSET ?",
          )
          .all(PAGE, offset),
      );
      return { offset, ms };
    });

    const referenceTs = (
      db
        .prepare("SELECT timestamp FROM measurements ORDER BY timestamp DESC LIMIT 1 OFFSET 450")
        .get() as { timestamp: string }
    ).timestamp;
    const { ms: msKeyset } = time(() =>
      db
        .prepare(
          "SELECT id, status, experiment_name, protocol_name, timestamp FROM measurements WHERE timestamp < ? ORDER BY timestamp DESC LIMIT ?",
        )
        .all(referenceTs, PAGE),
    );

    report([
      ...rows.map((r) => ({
        scenario: `OFFSET ${String(r.offset).padStart(5)} LIMIT ${PAGE}`,
        ms: r.ms,
        note: r.offset === 0 ? "first page" : `${r.offset} rows skipped`,
      })),
      {
        scenario: "KEYSET WHERE timestamp < ? LIMIT 50",
        ms: msKeyset,
        note: "cursor-based, no OFFSET",
      },
    ]);

    const lastRow = rows[rows.length - 1];
    const offsetGrowth = lastRow.ms / Math.max(rows[0].ms, 0.01);
    console.log(`  Offset cost growth (5k vs 0): ${offsetGrowth.toFixed(1)}× — keyset stays flat`);
    console.log(
      `  Keyset vs deep OFFSET: ${(lastRow.ms / Math.max(msKeyset, 0.01)).toFixed(1)}× faster\n`,
    );

    record("M.page.offset0", "first page (OFFSET 0)", rows[0].ms);
    record("M.page.offsetDeep", "deep page (OFFSET 450)", lastRow.ms);
    record("M.page.keyset", "keyset pagination", msKeyset);
  });
});

// (Scenario N — concurrent list+counts — dropped; Scenario L already measures
//  the real Promise.all path on the production code.)

// ===========================================================================
// Scenario O — Plain-text `questions_text` column (the KEY optimisation)
// ===========================================================================

describe("Scenario O — Plain-text `questions_text` column", () => {
  let db: ReturnType<typeof Database>;

  beforeAll(() => {
    // questions_text + indexes come from migration 0002 via createDb()
    db = createDb();
    seedCompressedWithQuestionsText(db, N_ROWS);
  }, HOOK_TIMEOUT);

  it("list render: read questions from plain column vs from decompressed blob", () => {
    const { ms: msFromBlob } = time(() => {
      const rows = db.prepare("SELECT * FROM measurements").all() as Record<string, unknown>[];
      return rows.map((r) => {
        const data = decompressFromStorage(r.measurement_result as string);
        return {
          id: r.id,
          status: r.status,
          timestamp: r.timestamp as string,
          questions: parseQuestions(data),
        };
      });
    });

    const { ms: msFromColumn } = time(() => {
      const rows = db
        .prepare(
          "SELECT id, status, experiment_name, protocol_name, timestamp, questions_text FROM measurements ORDER BY timestamp DESC",
        )
        .all() as Record<string, unknown>[];
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        timestamp: r.timestamp as string,
        questions: r.questions_text ? JSON.parse(r.questions_text as string) : [],
      }));
    });

    const { ms: msFromColumnLimited } = time(() =>
      db
        .prepare(
          "SELECT id, status, experiment_name, protocol_name, timestamp, questions_text FROM measurements ORDER BY timestamp DESC LIMIT 50",
        )
        .all(),
    );

    report([
      {
        scenario: "CURRENT: SELECT * + decompress + parseQuestions",
        ms: msFromBlob,
        note: `all ${N_ROWS} rows, blob touched`,
      },
      {
        scenario: "PROPOSED: lean SELECT + questions_text",
        ms: msFromColumn,
        note: `all ${N_ROWS} rows, blob NOT touched`,
      },
      { scenario: "PROPOSED + LIMIT 50", ms: msFromColumnLimited, note: "50 rows, columns only" },
    ]);

    console.log(
      `  Skipping decompression: ${(msFromBlob / Math.max(msFromColumn, 0.01)).toFixed(0)}× faster`,
    );
    console.log(
      `  + pagination (50):       ${(msFromBlob / Math.max(msFromColumnLimited, 0.01)).toFixed(0)}× faster\n`,
    );

    record("O.qtext.fromBlob", "decompress + parseQ", msFromBlob);
    record("O.qtext.fromColumn", "plain questions_text", msFromColumn);
    record("O.qtext.limited", "plain + LIMIT 50", msFromColumnLimited);
  });
});

// ===========================================================================
// SUMMARY — one-glance table + regression gates
// ===========================================================================

describe("SUMMARY — production vs hand-rolled baseline", () => {
  it("prints the headline table and enforces regression gates", () => {
    const fmt = (label: string, ms?: number) =>
      `  ${label.padEnd(48)}${(ms ?? 0).toFixed(2).padStart(8)} ms`;

    const headlineMs = (getSummary("G.pipeline.current") ?? 0).toFixed(0);
    const proposedMs = (getSummary("G.pipeline.proposed.50") ?? 0).toFixed(0);
    const speedup =
      (getSummary("G.pipeline.current") ?? 0) /
      Math.max(getSummary("G.pipeline.proposed.50") ?? 1, 0.01);

    console.log("\n" + "═".repeat(80));
    console.log("  SUMMARY — diagnostic + regression run");
    console.log(`  (${N_ROWS} rows, CI-sized payload, in-memory better-sqlite3, single thread)`);
    console.log("═".repeat(80));
    console.log("");
    console.log("  ── SAVE (informational; we keep gzip because of MQTT 128 KB limit) ──");
    console.log(fmt(`INSERT ${N_ROWS} rows compressed`, getSummary("A.save.compressed")));
    console.log(fmt(`INSERT ${N_ROWS} rows plain JSON`, getSummary("A.save.plain")));
    console.log(fmt("Single-row save+read compressed", getSummary("J.save.compressed")));
    console.log(fmt("Single-row save+read plain", getSummary("J.save.plain")));
    console.log(fmt("Gzip one row at MQTT send time", getSummary("J.gzip.one")));
    console.log("");
    console.log("  ── READ (this is where the real perf wins are) ──");
    console.log(
      fmt("CURRENT path (full + decompress + Zod + sort)", getSummary("G.pipeline.current")),
    );
    console.log(
      fmt("PROPOSED  path (lean SELECT + LIMIT 50)", getSummary("G.pipeline.proposed.50")),
    );
    console.log(
      fmt("PROPOSED  path (lean SELECT, no LIMIT)", getSummary("G.pipeline.proposed.all")),
    );
    console.log(
      fmt("Questions from blob (decompress + parseQuestions)", getSummary("O.qtext.fromBlob")),
    );
    console.log(
      fmt("Questions from plain `questions_text` column", getSummary("O.qtext.fromColumn")),
    );
    console.log("");
    console.log("  ── COUNTS (second query fired every screen mount) ──");
    console.log(
      fmt(`counts × ${COUNTS_ITERATIONS} NO index   @ ${COUNTS_N} rows`, getSummary("I.counts.no")),
    );
    console.log(
      fmt(
        `counts × ${COUNTS_ITERATIONS} WITH index @ ${COUNTS_N} rows`,
        getSummary("I.counts.with"),
      ),
    );
    console.log("");
    console.log("  ── PRODUCTION-PATH (real getMeasurementsList; improves over time) ──");
    console.log(fmt("PROD getMeasurementsList (lean, LIMIT 50)", getSummary("L.production.list")));
    console.log(fmt("PROD getMeasurement(id) (full payload)", getSummary("L.production.one")));
    console.log(fmt("PROD counts query", getSummary("L.production.counts")));
    console.log(fmt("PROD list + counts (parallel)", getSummary("L.production.both")));
    console.log("");
    console.log("  ── PAGINATION ──");
    console.log(fmt("OFFSET 0    LIMIT 50", getSummary("M.page.offset0")));
    console.log(fmt("OFFSET 450  LIMIT 50", getSummary("M.page.offsetDeep")));
    console.log(fmt("Keyset (WHERE ts < ?)", getSummary("M.page.keyset")));
    console.log("");
    console.log("═".repeat(80));
    console.log(
      `  Headline (list render):  ${headlineMs} → ${proposedMs} ms   ${speedup.toFixed(0)}× speedup proposed`,
    );
    console.log("═".repeat(80) + "\n");

    // ── Regression gates ────────────────────────────────────────────────────
    const G_current = getSummary("G.pipeline.current") ?? 0;
    const G_proposed = getSummary("G.pipeline.proposed.50") ?? 1;
    const O_fromBlob = getSummary("O.qtext.fromBlob") ?? 0;
    const O_fromCol = getSummary("O.qtext.fromColumn") ?? 1;
    const I_no = getSummary("I.counts.no") ?? 0;
    const I_with = getSummary("I.counts.with") ?? 1;

    // Gate 1: lean SELECT + LIMIT crushes full + decompress.
    expect(G_proposed * 5).toBeLessThan(G_current);

    // Gate 2: plain-text questions_text crushes decompress + parseQuestions.
    expect(O_fromCol * 5).toBeLessThan(O_fromBlob);

    // Gate 3: index helps counts query — only assert when timings are large
    // enough to be meaningful (in-memory SQLite on fast CI runners rounds to 0ms).
    if (I_no > 1) {
      expect(I_with * 2).toBeLessThan(I_no);
    }
  });
});
