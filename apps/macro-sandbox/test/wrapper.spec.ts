import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wrapperPath = resolve(__dirname, "../lib/wrappers/wrapper.js");
const helpersPath = resolve(__dirname, "../lib/helpers/helpers.js");
const tempDirs: string[] = [];

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

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("JavaScript macro wrapper diagnostics", () => {
  it("logs only the input shape and identifiers before execution", () => {
    const result = runWrapper('output["ok"] = true;', [
      {
        id: "row-1",
        macro_id: "macro-123",
        workbook_version_id: "workbook-version-456",
        data: {
          set: [
            {
              label: "SPAD",
              measurement: "MEASUREMENT_VALUE_MUST_NOT_APPEAR",
              latitude: 52.3676,
              longitude: 4.9041,
            },
          ],
          gps: { latitude: 52.3676, longitude: 4.9041 },
        },
      },
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr, `wrapper stdout: ${result.stdout}`).not.toBe("");
    const fingerprint = JSON.parse(result.stderr.trim()) as Record<string, unknown>;
    expect(fingerprint).toEqual({
      msg: "Macro input shape fingerprint",
      operation: "executeMacro",
      boundary: "sandbox-pre-execution",
      typeof: "object",
      isArray: false,
      length: null,
      topLevelKeys: ["gps", "set"],
      setIsArray: true,
      setLength: 1,
      setLabels: ["SPAD"],
      macro_id: "macro-123",
      workbook_version_id: "workbook-version-456",
    });
    expect(result.stderr).not.toContain("MEASUREMENT_VALUE_MUST_NOT_APPEAR");
    expect(result.stderr).not.toContain("52.3676");
    expect(result.stderr).not.toContain("4.9041");
  });

  it("includes the JavaScript error type and fingerprints failing items", () => {
    const result = runWrapper('throw new TypeError("bad input");', [
      { id: "row-1", macro_id: "macro-123", data: { set: [] } },
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr, `wrapper stdout: ${result.stdout}`).not.toBe("");
    expect(JSON.parse(result.stderr.trim())).toMatchObject({
      boundary: "sandbox-pre-execution",
      macro_id: "macro-123",
    });
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "success",
      results: [{ id: "row-1", success: false, error: "TypeError: bad input" }],
    });
  });
});
