import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function listedShots(numericCapture: string | undefined): string[] {
  const result = spawnSync("pnpm", ["exec", "tsx", "scripts/capture-docs-media.ts", "--list"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: { ...process.env, E2E_NUMERIC_SORT_CAPTURE: numericCapture },
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0]);
}

describe("documentation capture registration", () => {
  it("lists regular shots without requiring the temporary numeric experiment", () => {
    const shots = listedShots(undefined);
    expect(shots).toContain("dashboard");
    expect(shots).not.toContain("numeric-question-sorting");
    expect(shots).not.toContain("numeric-question-sorting-ascending");
  });

  it("makes both numeric shots selectable when the fixture wrapper opts in", () => {
    const shots = listedShots("1");
    expect(shots).toContain("dashboard");
    expect(shots).toContain("numeric-question-sorting");
    expect(shots).toContain("numeric-question-sorting-ascending");
  });
});
