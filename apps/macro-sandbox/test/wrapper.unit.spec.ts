import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Stage the wrapper in the layout the image uses (wrappers/ beside src/helpers/), then run it the
// way handler.js does: a child `node` under the permission model, allowed to read only the task
// and batch files. No key and no docker, so this runs in CI.
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");

let taskDir: string;
let batchDir: string;

beforeAll(() => {
  // Node's permission model matches real paths; macOS os.tmpdir() is a symlink, while the Lambda
  // runtime's /tmp and /var/task are already real, so resolving here only affects this test.
  taskDir = realpathSync(mkdtempSync(join(tmpdir(), "mstask_")));
  mkdirSync(join(taskDir, "wrappers"), { recursive: true });
  mkdirSync(join(taskDir, "src", "helpers"), { recursive: true });
  cpSync(join(repo, "lib", "wrappers", "wrapper.js"), join(taskDir, "wrappers", "wrapper.js"));
  cpSync(join(repo, "lib", "helpers", "helpers.js"), join(taskDir, "src", "helpers", "helpers.js"));
  batchDir = realpathSync(mkdtempSync(join(tmpdir(), "msbatch_")));
});

afterAll(() => {
  for (const dir of [taskDir, batchDir]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

interface Item {
  id: string;
  data: unknown;
  context?: unknown;
}

function runMacro(script: string, items: Item[]) {
  const scriptPath = join(batchDir, "script");
  const inputPath = join(batchDir, "input.json");
  writeFileSync(scriptPath, script);
  writeFileSync(inputPath, JSON.stringify(items));

  const stdout = execFileSync(
    "node",
    [
      "--permission",
      `--allow-fs-read=${taskDir}`,
      `--allow-fs-read=${batchDir}`,
      join(taskDir, "wrappers", "wrapper.js"),
      scriptPath,
      inputPath,
    ],
    { encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: "/tmp" } },
  );

  return JSON.parse(stdout) as {
    status: string;
    results: { id: string; success: boolean; output?: Record<string, unknown>; error?: string }[];
  };
}

describe("javascript wrapper isolation", () => {
  it("runs a normal macro against its input and context", () => {
    const res = runMacro("return { doubled: json.n * 2, tag: ctx.tag };", [
      { id: "a", data: { n: 21 }, context: { tag: "ok" } },
    ]);
    expect(res.status).toBe("success");
    expect(res.results[0]).toMatchObject({
      id: "a",
      success: true,
      output: { doubled: 42, tag: "ok" },
    });
  });

  it("drops an output that serialises to nothing instead of failing the item", () => {
    // forEach returns undefined; a macro that forgets to return hits the same path.
    const res = runMacro("output = json.xs.forEach(function () {});", [
      { id: "a", data: { xs: [1, 2, 3] } },
    ]);
    expect(res.status).toBe("success");
    expect(res.results[0].success).toBe(true);
    expect(res.results[0].output).toBeUndefined();
  });

  it("gives the macro no wall clock", () => {
    const res = runMacro("return { date: typeof Date };", [{ id: "a", data: {} }]);
    expect(res.status).toBe("success");
    expect(res.results[0].output).toEqual({ date: "undefined" });
  });

  it("gives the macro no handle on the host realm", () => {
    // The macro reports what it can see; the fix makes every answer the safe one.
    const res = runMacro(
      `return {
         hostProcess: typeof globalThis.process,
         fromIntrinsic: (() => { try { return (0).constructor.constructor("return 1")(); } catch (e) { return "blocked"; } })(),
         fromInputData: (() => { try { return json.constructor.constructor("return 1")(); } catch (e) { return "blocked"; } })(),
       };`,
      [{ id: "a", data: { x: 1 } }],
    );
    expect(res.status).toBe("success");
    expect(res.results[0].output).toEqual({
      hostProcess: "undefined",
      fromIntrinsic: "blocked",
      fromInputData: "blocked",
    });
  });

  it("cannot touch the filesystem or spawn, even if isolation were bypassed", () => {
    // These go through the permission model, which denies them regardless of the vm layer.
    const res = runMacro(
      `var r = {};
       try { r.spawn = (0).constructor.constructor("return require('child_process')")(); r.spawn = "reached"; }
       catch (e) { r.spawn = "blocked"; }
       return r;`,
      [{ id: "a", data: {} }],
    );
    expect(res.status).toBe("success");
    expect(res.results[0].output).toEqual({ spawn: "blocked" });
  });
});
