import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wrapperPath = resolve(__dirname, "../lib/wrappers/wrapper.js");
const helpersPath = resolve(__dirname, "../lib/helpers/helpers.js");
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

function runWrapper(script: string, items: unknown[]) {
  const dir = mkdtempSync(resolve(tmpdir(), "macro-wrapper-test-"));
  tempDirs.push(dir);
  const runtimeWrapperPath = resolve(dir, "wrappers/wrapper.js");
  const runtimeHelpersPath = resolve(dir, "src/helpers/helpers.js");
  const scriptPath = resolve(dir, "script.js");
  const inputPath = resolve(dir, "input.json");
  mkdirSync(resolve(dir, "wrappers"), { recursive: true });
  mkdirSync(resolve(dir, "src/helpers"), { recursive: true });
  writeFileSync(runtimeWrapperPath, readFileSync(wrapperPath));
  writeFileSync(runtimeHelpersPath, readFileSync(helpersPath));
  writeFileSync(scriptPath, script, "utf8");
  writeFileSync(inputPath, JSON.stringify(items), "utf8");

  return spawnSync(process.execPath, [runtimeWrapperPath, scriptPath, inputPath], {
    encoding: "utf8",
  });
}

function fixtureItems() {
  return fixture.cases.map((testCase, index) => ({
    id: `row-${index}`,
    macro_id: `macro-${index}`,
    workbook_version_id: "workbook-version-456",
    data: testCase.data,
  }));
}

function expectedFingerprints() {
  return fixture.cases.map((testCase, index) => ({
    msg: "Macro input shape fingerprint",
    operation: "executeMacro",
    boundary: "sandbox-pre-execution",
    ...testCase.expected,
    macro_id: `macro-${index}`,
    workbook_version_id: "workbook-version-456",
  }));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("JavaScript macro wrapper diagnostics", () => {
  it("matches every v2 fingerprint fixture through structured stdout", () => {
    expect(fixture.fixtureVersion).toBe(2);
    const result = runWrapper('output["ok"] = true;', fixtureItems());

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const envelope = JSON.parse(result.stdout) as WrapperEnvelope;
    expect(envelope.status).toBe("success");
    expect(envelope.fingerprints).toEqual(expectedFingerprints());

    const emittedFingerprints = JSON.stringify(envelope.fingerprints);
    for (const sentinel of fixture.privacySentinels) {
      expect(emittedFingerprints).not.toContain(sentinel);
    }
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
          setTypeof: "array",
        },
      ],
    });
  });
});
