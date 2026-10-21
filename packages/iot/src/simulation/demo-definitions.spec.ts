import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("scrubs every demo recording and runs each macro against its expected output", () => {
  const script = resolve(__dirname, "../demo-sensors/test_definitions.py");
  expect(() => execFileSync("python3", [script], { stdio: "pipe" })).not.toThrow();
});
