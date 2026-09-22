import { readdirSync } from "fs";
import { join, relative, resolve } from "path";
import { describe, expect, it } from "vitest";

const ROUTES_DIR = resolve(__dirname, "../../app");
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/u;

function collectTestFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectTestFiles(path);
    return TEST_FILE.test(entry.name) ? [relative(ROUTES_DIR, path)] : [];
  });
}

describe("src/app carries no test files", () => {
  it("keeps vitest out of the app bundle", () => {
    // expo-router bundles the whole of src/app through require.context, so a
    // test file there drags vitest — and Vite's module-runner, which Metro
    // cannot parse — into the Android bundle. The unit suite never notices:
    // it does not build a bundle. Route files are thin re-export shells; test
    // the screen or component they point at instead.
    expect(collectTestFiles(ROUTES_DIR)).toEqual([]);
  });
});
