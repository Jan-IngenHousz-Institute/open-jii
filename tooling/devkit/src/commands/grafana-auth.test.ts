import { describe, expect, it, vi } from "vitest";

import { authenticate, parseArgs } from "./grafana-auth.js";
import type { GrafanaAuthArgs, GrafanaAuthDependencies } from "./grafana-auth.js";

const args: GrafanaAuthArgs = {
  environment: "prod",
  url: "https://g-abc123.grafana-workspace.eu-central-1.amazonaws.com",
};

function deps(overrides: Partial<GrafanaAuthDependencies> = {}) {
  const lines: string[] = [];
  const store = vi.fn<GrafanaAuthDependencies["store"]>().mockResolvedValue(undefined);
  const verify = vi.fn<GrafanaAuthDependencies["verify"]>().mockResolvedValue(22);
  const value: GrafanaAuthDependencies = {
    readInput: () => "glsa_secret\n",
    verify,
    store,
    write: (text) => lines.push(text),
    ...overrides,
  };
  return { value, lines, store, verify };
}

describe("parseArgs", () => {
  it("builds the workspace's address from its id", () => {
    expect(parseArgs(["--", "prod", "--workspace", "g-abc123"])).toEqual(args);
  });

  it("refuses a missing or malformed workspace id, and an unknown environment", () => {
    expect(() => parseArgs(["prod"])).toThrow("--workspace g-<id>");
    expect(() => parseArgs(["prod", "--workspace", "evil.example/"])).toThrow("--workspace g-<id>");
    expect(() => parseArgs(["staging", "--workspace", "g-abc123"])).toThrow("prod or dev");
  });
});

describe("authenticate", () => {
  it("verifies the token against the workspace, stores it with the address, and never prints it", async () => {
    const d = deps();

    await authenticate(args, d.value);

    expect(d.verify).toHaveBeenCalledWith(args.url, "glsa_secret");
    expect(d.store).toHaveBeenCalledWith({
      GRAFANA_PROD_URL: args.url,
      GRAFANA_PROD_TOKEN: "glsa_secret",
    });
    expect(d.lines.join("")).toContain("reads 22 alert rules");
    expect(d.lines.join("")).not.toContain("glsa_secret");
  });

  it("refuses empty or whitespace-laden input before verifying", async () => {
    const empty = deps({ readInput: () => "\n" });
    const spaced = deps({ readInput: () => "glsa key\n" });

    await expect(authenticate(args, empty.value)).rejects.toThrow("No token received");
    await expect(authenticate(args, spaced.value)).rejects.toThrow("contains whitespace");
    expect(empty.verify).not.toHaveBeenCalled();
    expect(spaced.verify).not.toHaveBeenCalled();
  });

  it("does not store a token that cannot read the rules", async () => {
    const d = deps({ verify: () => Promise.reject(new Error("reads no alert rules")) });

    await expect(authenticate(args, d.value)).rejects.toThrow("reads no alert rules");
    expect(d.store).not.toHaveBeenCalled();
  });
});
