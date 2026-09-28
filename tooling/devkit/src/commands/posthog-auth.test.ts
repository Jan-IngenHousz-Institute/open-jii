import { describe, expect, it, vi } from "vitest";

import { authenticate } from "./posthog-auth.js";
import type { PostHogAuthDependencies } from "./posthog-auth.js";

function deps(overrides: Partial<PostHogAuthDependencies> = {}) {
  const lines: string[] = [];
  const storeFile = vi.fn<PostHogAuthDependencies["storeFile"]>().mockResolvedValue(undefined);
  const verify = vi.fn<PostHogAuthDependencies["verify"]>().mockResolvedValue(["openJII (80726)"]);
  const value: PostHogAuthDependencies = {
    readInput: () => "phx_secret\n",
    verify,
    storeFile,
    write: (text) => lines.push(text),
    ...overrides,
  };
  return { value, lines, storeFile, verify };
}

describe("authenticate", () => {
  it("verifies the key, stores it, and never prints it", async () => {
    const d = deps();

    await authenticate(d.value);

    expect(d.verify).toHaveBeenCalledWith("phx_secret");
    expect(d.storeFile).toHaveBeenCalledWith("phx_secret");
    expect(d.lines.join("")).toContain(
      "verified for openJII (80726); stored in tooling/devkit/.env",
    );
    expect(d.lines.join("")).not.toContain("phx_secret");
  });

  it("refuses empty or whitespace-laden input before verifying", async () => {
    const empty = deps({ readInput: () => "\n" });
    const spaced = deps({ readInput: () => "phx key\n" });

    await expect(authenticate(empty.value)).rejects.toThrow("No key received");
    await expect(authenticate(spaced.value)).rejects.toThrow("contains whitespace");
    expect(empty.verify).not.toHaveBeenCalled();
    expect(spaced.verify).not.toHaveBeenCalled();
  });

  it("does not store a key that cannot read the project", async () => {
    const d = deps({ verify: () => Promise.reject(new Error("cannot read project 80726")) });

    await expect(authenticate(d.value)).rejects.toThrow("80726");
    expect(d.storeFile).not.toHaveBeenCalled();
  });
});
