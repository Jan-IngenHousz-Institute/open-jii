import { describe, expect, it } from "vitest";

import { oauthClientManagement } from "./client-management";

describe("OAuth operator context", () => {
  it("isolates operator provisioning from concurrent HTTP requests", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operator = oauthClientManagement.run(true, async () => {
      await pending;
      expect(oauthClientManagement.getStore()).toBe(true);
    });
    expect(oauthClientManagement.getStore()).toBeUndefined();
    release?.();
    await operator;
    expect(oauthClientManagement.getStore()).toBeUndefined();
  });

  it("clears authorization after a failed registration", () => {
    expect(() =>
      oauthClientManagement.run(true, () => {
        throw new Error("invalid client");
      }),
    ).toThrow("invalid client");
    expect(oauthClientManagement.getStore()).toBeUndefined();
  });
});
