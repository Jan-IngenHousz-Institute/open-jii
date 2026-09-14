import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { authenticate, upsertEnvFile } from "./linear-auth.js";
import type { AuthDependencies } from "./linear-auth.js";

function deps(overrides: Partial<AuthDependencies> = {}) {
  const lines: string[] = [];
  const storeKeychain = vi.fn<AuthDependencies["storeKeychain"]>().mockResolvedValue(undefined);
  const storeFile = vi.fn<AuthDependencies["storeFile"]>().mockResolvedValue(undefined);
  const verify = vi
    .fn<AuthDependencies["verify"]>()
    .mockResolvedValue({ name: "Petar", teams: ["OJD"] });
  const value: AuthDependencies = {
    readInput: () => "lin_api_secret\n",
    verify,
    storeKeychain,
    storeFile,
    write: (text) => lines.push(text),
    ...overrides,
  };
  return { value, lines, storeKeychain, storeFile, verify };
}

describe("authenticate", () => {
  it("verifies the key, stores it in the keychain, and never prints it", async () => {
    const d = deps();

    await authenticate(false, d.value);

    expect(d.verify).toHaveBeenCalledWith("lin_api_secret");
    expect(d.storeKeychain).toHaveBeenCalledWith("lin_api_secret");
    expect(d.storeFile).not.toHaveBeenCalled();
    expect(d.lines.join("")).toContain("verified for Petar, teams OJD; stored in the OS keychain");
    expect(d.lines.join("")).not.toContain("lin_api_secret");
  });

  it("stores in the env file when asked", async () => {
    const d = deps();

    await authenticate(true, d.value);

    expect(d.storeFile).toHaveBeenCalledWith("lin_api_secret");
    expect(d.storeKeychain).not.toHaveBeenCalled();
  });

  it("refuses empty or whitespace-laden input before verifying", async () => {
    const empty = deps({ readInput: () => "\n" });
    const spaced = deps({ readInput: () => "lin api\n" });

    await expect(authenticate(false, empty.value)).rejects.toThrow("No key received");
    await expect(authenticate(false, spaced.value)).rejects.toThrow("contains whitespace");
    expect(empty.verify).not.toHaveBeenCalled();
    expect(spaced.verify).not.toHaveBeenCalled();
  });

  it("does not store a key Linear rejects", async () => {
    const d = deps({ verify: () => Promise.reject(new Error("Linear returned 401")) });

    await expect(authenticate(false, d.value)).rejects.toThrow("401");
    expect(d.storeKeychain).not.toHaveBeenCalled();
  });
});

describe("upsertEnvFile", () => {
  it("replaces the key line, keeps other lines, and sets owner-only mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "devkit-auth-"));
    const path = join(dir, ".claude", ".env");

    await upsertEnvFile(path, "first");
    await upsertEnvFile(path, "second");

    expect(await readFile(path, "utf8")).toBe("LINEAR_API_KEY=second\n");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
