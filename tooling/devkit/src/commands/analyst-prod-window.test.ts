import { mkdtempSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  WINDOW_SECONDS,
  closeWindow,
  describeRemaining,
  markerPath,
  openWindow,
  remainingSeconds,
  reportWindow,
} from "./analyst-prod-window.js";
import type { WindowDependencies } from "./analyst-prod-window.js";

let root: string;
let written: string[];
let deps: WindowDependencies;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "openjii-window-"));
  await mkdir(join(root, ".claude"), { recursive: true });
  written = [];
  deps = { root, now: () => new Date("2026-09-21T12:00:00Z"), write: (text) => written.push(text) };
});

describe("remainingSeconds", () => {
  it("counts down from the window length", () => {
    const opened = new Date("2026-09-21T12:00:00Z");

    expect(remainingSeconds(opened, opened)).toBe(WINDOW_SECONDS);
    expect(remainingSeconds(opened, new Date("2026-09-21T13:00:00Z"))).toBe(3600);
  });

  it("never goes negative", () => {
    expect(
      remainingSeconds(new Date("2026-09-21T09:00:00Z"), new Date("2026-09-21T12:00:00Z")),
    ).toBe(0);
  });
});

describe("describeRemaining", () => {
  it("rounds up to whole minutes and gets the singular right", () => {
    expect(describeRemaining(7200)).toBe("120 minutes");
    expect(describeRemaining(61)).toBe("2 minutes");
    expect(describeRemaining(30)).toBe("1 minute");
  });
});

describe("openWindow", () => {
  it("writes an owner-only marker and says how long it lasts", async () => {
    await expect(openWindow(deps)).resolves.toBe(0);

    const stats = await stat(markerPath(root));
    expect(stats.mode & 0o777).toBe(0o600);
    expect(written.join("")).toContain("120 minutes");
  });

  it("says the agent still cannot change anything", async () => {
    await openWindow(deps);

    expect(written.join("")).toContain("cannot change anything");
  });
});

describe("closeWindow", () => {
  it("removes the marker, and does not mind if there was none", async () => {
    await openWindow(deps);
    await expect(closeWindow(deps)).resolves.toBe(0);
    await expect(stat(markerPath(root))).rejects.toThrow();

    await expect(closeWindow(deps)).resolves.toBe(0);
  });
});

describe("reportWindow", () => {
  it("reports closed when no marker exists", async () => {
    await reportWindow(deps);

    expect(written.join("")).toContain("closed");
  });

  it("reports the time left while it is open", async () => {
    await writeFile(markerPath(root), "opened\n");
    await reportWindow(deps);

    expect(written.join("")).toMatch(/open for another \d+ minutes/);
  });

  it("reports an expired window as expired rather than open", async () => {
    await writeFile(markerPath(root), "opened\n");
    const long = { ...deps, now: () => new Date("2026-09-21T23:00:00Z") };
    await reportWindow(long);

    expect(written.join("")).toContain("expired");
  });
});
