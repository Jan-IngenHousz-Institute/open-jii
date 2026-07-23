import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const guardsDir = resolve(__dirname, "../lib/guards");

interface GuardDecision {
  id: string;
  classification: string;
  error: string | null;
}
interface ResultRow {
  id: string;
  success: boolean;
  output?: unknown;
  error?: string | null;
}
interface GuardModule {
  INPUT_CONTRACT: string;
  CLASSIFICATIONS: string[];
  MARKER_ERROR_CODE: string;
  classifyValue(value: unknown): string;
  errorForClassification(classification: string): string | null;
  guardBatch(
    event: { input_contract: string | null; items: { id: string; data: unknown }[] },
    mode: string,
  ): {
    markerValid: boolean;
    markerError: string | null;
    decisions: GuardDecision[];
    telemetry: Record<string, unknown>;
  };
  partitionItems(
    items: { id: string; data: unknown }[],
    decisions: GuardDecision[],
  ): { validItems: { id: string; data: unknown }[]; invalidResults: ResultRow[] };
  mergeResults(
    decisions: GuardDecision[],
    executedResults: ResultRow[],
    invalidResults: ResultRow[],
  ): ResultRow[];
}

// The real JS guard, imported in-process.
const guard = require(resolve(guardsDir, "guard.js")) as GuardModule;

interface CorpusCase {
  name: string;
  dataJson: string;
  classification: string;
  error: string | null;
}
interface MarkerCase {
  name: string;
  inputContract: string | null;
  markerValid: boolean;
}
interface BatchCase {
  name: string;
  inputContract: string | null;
  items: { id: string; dataJson: string }[];
  expected: {
    markerValid: boolean;
    decisions: { id: string; classification: string; error: string | null }[];
  };
}
interface MergedRow {
  id: string;
  success: boolean;
  error: string | null;
}
interface EnforceBatch {
  name: string;
  inputContract: string | null;
  items: { id: string; dataJson: string }[];
  expected: { markerValid: boolean; markerError?: string; merged?: MergedRow[] };
}
interface Corpus {
  corpusVersion: number;
  inputContract: string;
  vocabulary: { classifications: string[]; errors: string[]; markerError: string };
  cases: CorpusCase[];
  markerCases: MarkerCase[];
  batches: BatchCase[];
  enforceBatches: EnforceBatch[];
}

const corpus = require(resolve(__dirname, "conformance/corpus.json")) as Corpus;

interface Decision {
  classification: string;
  error: string | null;
}

/** A language runner: how to spawn its guard CLI. */
interface Runner {
  language: string;
  cmd: string;
  args: string[];
}

const RUNNERS: Runner[] = [
  { language: "javascript", cmd: process.execPath, args: [resolve(guardsDir, "guard.js")] },
  { language: "python", cmd: "python3", args: [resolve(guardsDir, "guard.py")] },
  { language: "r", cmd: "Rscript", args: [resolve(guardsDir, "guard.R")] },
];

/** Whether the runtime for a runner is present on this machine. */
function runnerAvailable(runner: Runner): boolean {
  const probe = spawnSync(runner.cmd, ["--version"], { encoding: "utf8" });
  return !probe.error;
}

/** Feed one compact JSON value per line to a runner; parse its decisions. */
function classifyWithRunner(runner: Runner, dataJsonLines: string[]): Decision[] {
  const res = spawnSync(runner.cmd, runner.args, {
    input: dataJsonLines.join("\n") + "\n",
    encoding: "utf8",
  });
  if (res.status !== 0) {
    throw new Error(`${runner.language} runner failed: ${res.stderr || res.stdout}`);
  }
  return res.stdout
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const [classification, error] = line.split("\t");
      return { classification, error: error === "-" ? null : error };
    });
}

function markerWithRunner(runner: Runner, value: string): boolean {
  const res = spawnSync(runner.cmd, [...runner.args, "--marker", value], { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`${runner.language} marker runner failed: ${res.stderr}`);
  }
  return res.stdout.trim() === "true";
}

interface EnforceOutput {
  markerInvalid: boolean;
  markerError?: string;
  rows: MergedRow[];
}

/** Drive the runner's --enforce mode with "<id>\t<dataJson>" lines. */
function enforceWithRunner(runner: Runner, batch: EnforceBatch): EnforceOutput {
  const input = batch.items.map((i) => `${i.id}\t${i.dataJson}`).join("\n") + "\n";
  const res = spawnSync(
    runner.cmd,
    [...runner.args, "--enforce", batch.inputContract ?? "__none__"],
    {
      input,
      encoding: "utf8",
    },
  );
  if (res.status !== 0) {
    throw new Error(`${runner.language} enforce runner failed: ${res.stderr || res.stdout}`);
  }
  const lines = res.stdout.split("\n").filter((l) => l !== "");
  if (lines[0]?.startsWith("MARKER_INVALID")) {
    return { markerInvalid: true, markerError: lines[0].split("\t")[1], rows: [] };
  }
  const rows = lines.map((line) => {
    const [id, success, error] = line.split("\t");
    return { id, success: success === "true", error: error === "-" ? null : error };
  });
  return { markerInvalid: false, rows };
}

describe("guard classification (in-process JS)", () => {
  it("classifies every corpus case as specified", () => {
    for (const c of corpus.cases) {
      const value = JSON.parse(c.dataJson) as unknown;
      const classification = guard.classifyValue(value);
      expect(classification, c.name).toBe(c.classification);
      expect(guard.errorForClassification(classification), c.name).toBe(c.error);
    }
  });

  it("keeps the corpus vocabulary aligned with the guard module", () => {
    expect(corpus.inputContract).toBe(guard.INPUT_CONTRACT);
    expect(corpus.vocabulary.classifications).toEqual(guard.CLASSIFICATIONS);
    expect(corpus.vocabulary.markerError).toBe(guard.MARKER_ERROR_CODE);
  });
});

const availableRunners = RUNNERS.filter(runnerAvailable);
const skippedRunners = RUNNERS.filter((r) => !availableRunners.includes(r)).map((r) => r.language);
if (skippedRunners.length > 0) {
  // Surface which runtimes were not exercised locally so a green run is not
  // mistaken for full three-language coverage.
  console.warn(`[guard-conformance] runtimes unavailable, skipped: ${skippedRunners.join(", ")}`);
}

const caseLines = corpus.cases.map((c) => c.dataJson);
const expectedCaseDecisions: Decision[] = corpus.cases.map((c) => ({
  classification: c.classification,
  error: c.error,
}));

describe.each(availableRunners)("guard runner conformance [$language]", (runner) => {
  it("produces the specified per-item decisions for every case in order", () => {
    const decisions = classifyWithRunner(runner, caseLines);
    expect(decisions).toEqual(expectedCaseDecisions);
  });

  it("validates the event marker identically to the contract", () => {
    for (const m of corpus.markerCases) {
      if (m.inputContract === null) continue; // null marker covered in-process below
      expect(markerWithRunner(runner, m.inputContract), m.name).toBe(m.markerValid);
    }
  });

  for (const batch of corpus.batches) {
    it(`partitions and orders the batch: ${batch.name}`, () => {
      const decisions = classifyWithRunner(
        runner,
        batch.items.map((i) => i.dataJson),
      );
      const expected = batch.expected.decisions.map((d) => ({
        classification: d.classification,
        error: d.error,
      }));
      expect(decisions).toEqual(expected);
    });
  }

  for (const batch of corpus.enforceBatches) {
    it(`enforce merges by position: ${batch.name}`, () => {
      const out = enforceWithRunner(runner, batch);
      if (batch.expected.markerValid) {
        expect(out.markerInvalid).toBe(false);
        expect(out.rows).toEqual(batch.expected.merged);
        // Every item round-trips exactly once in original order.
        expect(out.rows).toHaveLength(batch.items.length);
      } else {
        expect(out.markerInvalid).toBe(true);
        expect(out.markerError).toBe(batch.expected.markerError);
      }
    });
  }
});

if (availableRunners.length > 1) {
  describe("cross-language parity", () => {
    it("all available runtimes agree on every case decision", () => {
      const outputs = availableRunners.map((r) => classifyWithRunner(r, caseLines));
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i], availableRunners[i].language).toEqual(outputs[0]);
      }
    });

    it("all available runtimes agree on every enforce merge", () => {
      for (const batch of corpus.enforceBatches) {
        const outputs = availableRunners.map((r) => enforceWithRunner(r, batch));
        for (let i = 1; i < outputs.length; i++) {
          expect(outputs[i], `${availableRunners[i].language}: ${batch.name}`).toEqual(outputs[0]);
        }
      }
    });
  });
}

describe("marker validation (in-process JS)", () => {
  it("matches every marker case including the null marker", () => {
    for (const m of corpus.markerCases) {
      const report = guard.guardBatch({ input_contract: m.inputContract, items: [] }, "shadow");
      expect(report.markerValid, m.name).toBe(m.markerValid);
    }
  });
});

describe("telemetry is bounded (in-process JS)", () => {
  it("never echoes the caller-supplied marker value", () => {
    const sentinel = "sneaky-marker-with-secret-☃";
    const report = guard.guardBatch(
      { input_contract: sentinel, items: [{ id: "a", data: { phi2: 1 } }] },
      "shadow",
    );
    const serialized = JSON.stringify(report.telemetry);
    expect(serialized).not.toContain(sentinel);
    expect(report.telemetry).not.toHaveProperty("input_contract");
    expect(report.telemetry.markerPresent).toBe(true);
    expect(report.telemetry.markerValid).toBe(false);
  });

  it("reports marker presence facts without a value", () => {
    const missing = guard.guardBatch({ input_contract: null, items: [] }, "shadow");
    expect(missing.telemetry.markerPresent).toBe(false);
    expect(missing.telemetry.markerValid).toBe(false);
    const valid = guard.guardBatch({ input_contract: guard.INPUT_CONTRACT, items: [] }, "shadow");
    expect(valid.telemetry.markerPresent).toBe(true);
    expect(valid.telemetry.markerValid).toBe(true);
  });
});

describe("enforce partition and positional merge (in-process JS)", () => {
  const batch = corpus.enforceBatches.find((b) => b.expected.merged);
  if (!batch) throw new Error("corpus is missing an enforce batch with expected merge");
  const items = batch.items.map((i) => ({ id: i.id, data: JSON.parse(i.dataJson) as unknown }));

  it("reassembles duplicate and empty IDs losslessly in original position", () => {
    const report = guard.guardBatch({ input_contract: batch.inputContract, items }, "enforce");
    expect(report.markerValid).toBe(batch.expected.markerValid);

    const { validItems, invalidResults } = guard.partitionItems(items, report.decisions);
    // Simulate the wrapper: each executed (canonical) item succeeds, in order.
    const executedResults: ResultRow[] = validItems.map((it) => ({ id: it.id, success: true }));

    const merged = guard.mergeResults(report.decisions, executedResults, invalidResults);

    // Exact identity, order, success, and error including duplicate/empty IDs.
    expect(merged.map((r) => ({ id: r.id, success: r.success, error: r.error ?? null }))).toEqual(
      batch.expected.merged,
    );
    // Every item round-trips exactly once.
    expect(merged).toHaveLength(items.length);
  });
});
