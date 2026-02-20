#!/usr/bin/env tsx
/**
 * Merge new/updated test cases from test/data/generate/ into
 * the persistent JSON files (samples.json, intensive.json, security.json).
 *
 * Each generate/<dir>/ must contain:
 *   - macro.{py,js,R}      — the script to execute
 *   - input.json            — array of { id, data } items
 *   - expectations.json     — { dataset, success, error, timeout?, name?, protocol_id? }
 *   - output.json           — (optional) expected per-item output
 *
 * Matching is by (name + language). Existing entries are replaced in-place;
 * new entries are appended. If generate/ is empty the JSONs are untouched.
 *
 * Run:
 *   pnpm test:generate               # from apps/macro-runner
 *   npx tsx test/data/generate.ts     # direct
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { basename, dirname, extname, join } from "path";
import { fileURLToPath } from "url";

// ── Paths ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname; // test/data/
const GENERATE_DIR = join(__dirname, "generate");

mkdirSync(DATA_DIR, { recursive: true });

// ── ANSI helpers ─────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

function header(label: string) {
  console.log(`\n${CYAN}${BOLD}── ${label} ${"─".repeat(Math.max(0, 60 - label.length))}${RESET}`);
}

// ── Types ────────────────────────────────────────────────────

type Dataset = "samples" | "intensive" | "security";

interface Expectations {
  dataset: Dataset;
  success: boolean;
  error: boolean;
  timeout?: number;
  name?: string;
  protocol_id?: string;
}

interface TestCase {
  name: string;
  language: string;
  script: string;
  items: { id: string; data: Record<string, unknown> }[];
  timeout: number;
  protocol_id: string;
  expect: {
    success: boolean;
    error: boolean;
    output?: Record<string, unknown>[];
  };
}

// ── Helpers ──────────────────────────────────────────────────

const LANG_MAP: Record<string, string> = {
  ".py": "python",
  ".js": "javascript",
  ".R": "r",
};

function readJSON<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function loadDataset(name: string): TestCase[] {
  const path = join(DATA_DIR, name);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as TestCase[];
}

/** Unique key for deduplication: name + language */
function tcKey(tc: TestCase): string {
  return `${tc.name}\0${tc.language}`;
}

// ── Build entry from generate/ directory ─────────────────────

function processGenerateDir(dirPath: string): { dataset: Dataset; entry: TestCase } | null {
  const dirName = basename(dirPath);

  const macro = (() => {
    for (const file of readdirSync(dirPath)) {
      if (!file.startsWith("macro.")) continue;
      const lang = LANG_MAP[extname(file)];
      if (lang) return { path: join(dirPath, file), language: lang };
    }
    return null;
  })();
  if (!macro) {
    console.warn(`  ${YELLOW}⚠${RESET} ${dirName}: no macro.{py,js,R} — ${DIM}skipping${RESET}`);
    return null;
  }

  const expectations = readJSON<Expectations>(join(dirPath, "expectations.json"));
  if (!expectations?.dataset) {
    console.warn(
      `  ${YELLOW}⚠${RESET} ${dirName}: missing expectations.json or dataset — ${DIM}skipping${RESET}`,
    );
    return null;
  }

  const items = readJSON<TestCase["items"]>(join(dirPath, "input.json"));
  if (!items) {
    console.warn(`  ${YELLOW}⚠${RESET} ${dirName}: no input.json — ${DIM}skipping${RESET}`);
    return null;
  }

  const output = readJSON<Record<string, unknown>[]>(join(dirPath, "output.json"));
  const name = expectations.name ?? dirName;

  const entry: TestCase = {
    name,
    language: macro.language,
    script: Buffer.from(readFileSync(macro.path, "utf-8")).toString("base64"),
    items,
    timeout: expectations.timeout ?? 10,
    protocol_id: expectations.protocol_id ?? `test-${expectations.dataset}-${name}`,
    expect: {
      success: expectations.success,
      error: expectations.error,
      ...(output ? { output } : {}),
    },
  };

  return { dataset: expectations.dataset, entry };
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  header("Merging generate/ into test data");

  // 1. Load existing persistent data
  const datasets: Record<Dataset, TestCase[]> = {
    samples: loadDataset("samples.json"),
    intensive: loadDataset("intensive.json"),
    security: loadDataset("security.json"),
  };

  const before: Record<Dataset, number> = {
    samples: datasets.samples.length,
    intensive: datasets.intensive.length,
    security: datasets.security.length,
  };

  // 2. Process generate/ directories
  if (!existsSync(GENERATE_DIR)) {
    console.log(`\n  ${DIM}No generate/ directory — nothing to merge.${RESET}\n`);
    return;
  }

  const dirs = readdirSync(GENERATE_DIR)
    .filter((d) => {
      const full = join(GENERATE_DIR, d);
      return statSync(full).isDirectory() && !d.startsWith(".");
    })
    .sort();

  if (dirs.length === 0) {
    console.log(`\n  ${DIM}generate/ is empty — nothing to merge.${RESET}\n`);
    return;
  }

  console.log(`\n  ${BOLD}Processing ${dirs.length} generate/ case(s):${RESET}\n`);

  let added = 0;
  let updated = 0;

  for (const dir of dirs) {
    const result = processGenerateDir(join(GENERATE_DIR, dir));
    if (!result) continue;

    const { dataset, entry } = result;
    const list = datasets[dataset];
    const entryKey = tcKey(entry);

    // Upsert: replace existing or append
    const idx = list.findIndex((tc) => tcKey(tc) === entryKey);
    const isUpdate = idx !== -1;

    if (isUpdate) {
      list[idx] = entry;
      updated++;
    } else {
      list.push(entry);
      added++;
    }

    const color = dataset === "security" ? RED : dataset === "intensive" ? YELLOW : GREEN;
    const action = isUpdate ? `${DIM}updated${RESET}` : `${GREEN}added${RESET}`;
    console.log(
      `    ${GREEN}✓${RESET} ${MAGENTA}${dir}${RESET} → ${color}${dataset}${RESET} ${DIM}(${entry.language})${RESET} ${action}`,
    );
  }

  // 3. Write JSON files
  header("Output");

  const DATASET_FILES: Record<Dataset, { file: string; color: string }> = {
    samples: { file: "samples.json", color: GREEN },
    intensive: { file: "intensive.json", color: YELLOW },
    security: { file: "security.json", color: RED },
  };

  console.log();
  for (const ds of ["samples", "intensive", "security"] as Dataset[]) {
    const { file, color } = DATASET_FILES[ds];
    const data = datasets[ds];
    writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2) + "\n");

    const delta = data.length - before[ds];
    const deltaStr = delta > 0 ? ` ${DIM}(+${delta} new)${RESET}` : "";
    console.log(
      `  ${GREEN}✓${RESET} ${color}${file}${RESET}  ${DIM}(${data.length} test cases)${RESET}${deltaStr}`,
    );
  }

  const total = datasets.samples.length + datasets.intensive.length + datasets.security.length;
  console.log(`\n  ${BOLD}${total}${RESET} ${DIM}total test cases${RESET}`);
  console.log(`  ${DIM}${added} added, ${updated} updated${RESET}\n`);
}

main();
