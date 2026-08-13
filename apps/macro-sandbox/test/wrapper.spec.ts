import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(
  __dirname,
  "../../../packages/api/fixtures/macro-input-shape-fingerprints.json",
);
const tempDirs: string[] = [];

interface FingerprintFixture {
  fixtureVersion: number;
  privacySentinels: string[];
  cases: {
    name: string;
    data: unknown;
    expected: Record<string, unknown>;
  }[];
}

interface WrapperEnvelope {
  status: string;
  results: Record<string, unknown>[];
  fingerprints: Record<string, unknown>[];
}

const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as FingerprintFixture;

// Interpreter overrides let local runs point at a venv / custom R library:
// MACRO_WRAPPER_PYTHON=/tmp/venv/bin/python MACRO_WRAPPER_RSCRIPT=Rscript pnpm test
const pythonBin = process.env.MACRO_WRAPPER_PYTHON ?? "python3";
const rscriptBin = process.env.MACRO_WRAPPER_RSCRIPT ?? "Rscript";

function runtimeAvailable(command: string, args: string[], env?: Record<string, string>): boolean {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return result.status === 0;
}

// The Python wrapper imports numpy/pandas/scipy at startup and the R wrapper
// needs jsonlite. CI runners provide neither (the container contract job was
// dropped per review), so the Python/R parity tests skip when the runtime is
// missing instead of failing.
const pythonAvailable = runtimeAvailable(pythonBin, ["-c", "import numpy, pandas, scipy"]);
// LC_CTYPE mirrors handler.R so non-ASCII fixture strings survive as UTF-8.
const rEnv = { LC_CTYPE: "C.UTF-8" };
const rAvailable = runtimeAvailable(rscriptBin, ["-e", "library(jsonlite)"], rEnv);

function stageRuntime(wrapperFile: string, helpersFile: string) {
  const dir = mkdtempSync(resolve(tmpdir(), "macro-wrapper-test-"));
  tempDirs.push(dir);
  mkdirSync(resolve(dir, "wrappers"), { recursive: true });
  mkdirSync(resolve(dir, "src/helpers"), { recursive: true });
  writeFileSync(
    resolve(dir, "wrappers", wrapperFile),
    readFileSync(resolve(__dirname, "../lib/wrappers", wrapperFile)),
  );
  writeFileSync(
    resolve(dir, "src/helpers", helpersFile),
    readFileSync(resolve(__dirname, "../lib/helpers", helpersFile)),
  );
  return dir;
}

function runWrapper(script: string, items: unknown[]) {
  const dir = stageRuntime("wrapper.js", "helpers.js");
  const scriptPath = resolve(dir, "script.js");
  const inputPath = resolve(dir, "input.json");
  writeFileSync(scriptPath, script, "utf8");
  writeFileSync(inputPath, JSON.stringify(items), "utf8");

  return spawnSync(process.execPath, [resolve(dir, "wrappers/wrapper.js"), scriptPath, inputPath], {
    encoding: "utf8",
  });
}

function runPythonWrapper(script: string, items: unknown[]) {
  const dir = stageRuntime("wrapper.py", "helpers.py");
  const scriptPath = resolve(dir, "script.py");
  const inputPath = resolve(dir, "input.json");
  writeFileSync(scriptPath, script, "utf8");
  writeFileSync(inputPath, JSON.stringify(items), "utf8");

  return spawnSync(pythonBin, [resolve(dir, "wrappers/wrapper.py"), scriptPath, inputPath], {
    encoding: "utf8",
  });
}

function runRWrapper(script: string, items: unknown[]) {
  const dir = stageRuntime("wrapper.R", "helpers.R");
  const scriptPath = resolve(dir, "script.R");
  const inputPath = resolve(dir, "input.json");
  writeFileSync(scriptPath, script, "utf8");
  writeFileSync(inputPath, JSON.stringify(items), "utf8");

  return spawnSync(rscriptBin, [resolve(dir, "wrappers/wrapper.R"), scriptPath, inputPath], {
    encoding: "utf8",
    env: { ...process.env, ...rEnv },
  });
}

function fixtureItems() {
  return fixture.cases.map((testCase, index) => ({
    id: `row-${index}`,
    macro_id: `macro-${index}`,
    workbook_version_id: "workbook-version-456",
    operation: "executeMacroBatch",
    data: testCase.data,
  }));
}

function expectedFingerprints() {
  return fixture.cases.map((testCase, index) => ({
    msg: "Macro input shape fingerprint",
    // Distinct from the backend's single-execution operation, proving the
    // wrappers stamp the per-item value rather than a hardcoded one.
    operation: "executeMacroBatch",
    boundary: "sandbox-pre-execution",
    ...testCase.expected,
    macro_id: `macro-${index}`,
    workbook_version_id: "workbook-version-456",
  }));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Shared parity assertion: the fixture contract is only meaningful if every
// runtime reproduces it byte-for-byte, redacted digests included.
function expectFixtureParity(stdout: string) {
  const envelope = JSON.parse(stdout) as WrapperEnvelope;
  expect(envelope.status).toBe("success");
  expect(envelope.results).toHaveLength(fixture.cases.length);
  expect(envelope.fingerprints).toEqual(expectedFingerprints());

  const emittedFingerprints = JSON.stringify(envelope.fingerprints);
  for (const sentinel of fixture.privacySentinels) {
    expect(emittedFingerprints).not.toContain(sentinel);
  }
}

describe("JavaScript macro wrapper diagnostics", () => {
  it("matches every v2 fingerprint fixture through structured stdout", () => {
    expect(fixture.fixtureVersion).toBe(2);
    const result = runWrapper('output["ok"] = true;', fixtureItems());

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expectFixtureParity(result.stdout);
  });

  it("includes the JavaScript error type and fingerprints failing items", () => {
    const result = runWrapper('throw new TypeError("bad input");', [
      { id: "row-1", macro_id: "macro-123", data: { set: [] } },
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "success",
      results: [{ id: "row-1", success: false, error: "TypeError: bad input" }],
      fingerprints: [
        {
          boundary: "sandbox-pre-execution",
          macro_id: "macro-123",
          // No operation on the item (older payload) surfaces as null.
          operation: null,
          setTypeof: "array",
        },
      ],
    });
  });
});

describe.skipIf(!pythonAvailable)("Python macro wrapper diagnostics", () => {
  it("matches every v2 fingerprint fixture through structured stdout", () => {
    const result = runPythonWrapper('output["ok"] = True', fixtureItems());

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expectFixtureParity(result.stdout);
  });
});

describe.skipIf(!rAvailable)("R macro wrapper diagnostics", () => {
  it("matches every v2 fingerprint fixture through structured stdout", () => {
    const result = runRWrapper("output$ok <- TRUE", fixtureItems());

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expectFixtureParity(result.stdout);
  });
});
