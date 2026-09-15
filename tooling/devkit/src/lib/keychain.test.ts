import { describe, expect, it, vi } from "vitest";

import { readKeychainSecret, writeKeychainSecret } from "./keychain.js";
import type { KeychainDependencies } from "./keychain.js";

function runner(result: { stdout: string; code: number }) {
  return vi.fn<KeychainDependencies["run"]>().mockResolvedValue(result);
}

const missingTool = () => Promise.reject(new Error("secret-tool is not available on this machine"));

describe("readKeychainSecret", () => {
  it("asks the macOS keychain for the account's item and trims the answer", async () => {
    const run = runner({ stdout: "lin_api_secret\n", code: 0 });

    await expect(
      readKeychainSecret("openjii-linear", { platform: "darwin", account: "petar", run }),
    ).resolves.toBe("lin_api_secret");
    expect(run).toHaveBeenCalledWith("security", [
      "find-generic-password",
      "-a",
      "petar",
      "-s",
      "openjii-linear",
      "-w",
    ]);
  });

  it("asks secret-tool on Linux", async () => {
    const run = runner({ stdout: "lin_api_secret\n", code: 0 });

    await expect(
      readKeychainSecret("openjii-linear", { platform: "linux", account: "dev", run }),
    ).resolves.toBe("lin_api_secret");
    expect(run).toHaveBeenCalledWith("secret-tool", ["lookup", "service", "openjii-linear"]);
  });

  it("is null when the item is absent, empty, or the tool is missing", async () => {
    const overrides = { platform: "darwin", account: "petar" } as const;

    await expect(
      readKeychainSecret("s", { ...overrides, run: runner({ stdout: "", code: 44 }) }),
    ).resolves.toBeNull();
    await expect(
      readKeychainSecret("s", { ...overrides, run: runner({ stdout: "  \n", code: 0 }) }),
    ).resolves.toBeNull();
    await expect(readKeychainSecret("s", { ...overrides, run: missingTool })).resolves.toBeNull();
  });

  it("is null on a platform with no keychain, so the caller falls back to the file", async () => {
    const run = runner({ stdout: "", code: 0 });

    await expect(
      readKeychainSecret("s", { platform: "win32", account: "dev", run }),
    ).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });
});

describe("writeKeychainSecret", () => {
  it("replaces an existing macOS item rather than adding a second one", async () => {
    const run = runner({ stdout: "", code: 0 });

    await writeKeychainSecret("openjii-linear", "lin_api_secret", {
      platform: "darwin",
      account: "petar",
      run,
    });

    // -U replaces in place. security has no stdin route, so the secret is in argv for this call.
    const [command, args] = run.mock.calls[0];
    expect(command).toBe("security");
    expect(args).toEqual([
      "add-generic-password",
      "-a",
      "petar",
      "-s",
      "openjii-linear",
      "-w",
      "lin_api_secret",
      "-U",
    ]);
  });

  it("passes the secret to secret-tool on stdin, never as an argument", async () => {
    const run = runner({ stdout: "", code: 0 });

    await writeKeychainSecret("openjii-linear", "lin_api_secret", {
      platform: "linux",
      account: "dev",
      run,
    });

    const [command, args, input] = run.mock.calls[0];
    expect(command).toBe("secret-tool");
    expect(args).not.toContain("lin_api_secret");
    expect(input).toBe("lin_api_secret");
  });

  it("points at the file fallback when the tool is missing, fails, or does not exist", async () => {
    await expect(
      writeKeychainSecret("s", "k", { platform: "linux", account: "dev", run: missingTool }),
    ).rejects.toThrow("pnpm linear:auth --file");
    await expect(
      writeKeychainSecret("s", "k", {
        platform: "darwin",
        account: "petar",
        run: runner({ stdout: "", code: 1 }),
      }),
    ).rejects.toThrow("pnpm linear:auth --file");
    await expect(
      writeKeychainSecret("s", "k", {
        platform: "win32",
        account: "dev",
        run: runner({ stdout: "", code: 0 }),
      }),
    ).rejects.toThrow("No keychain support on win32");
  });
});
