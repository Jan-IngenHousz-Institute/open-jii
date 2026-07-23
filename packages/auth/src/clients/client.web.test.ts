import { beforeEach, describe, expect, it, vi } from "vitest";

import { cancelPasskeyCeremony } from "./client.web";

const { cancelCeremony } = vi.hoisted(() => ({ cancelCeremony: vi.fn() }));

vi.mock("@simplewebauthn/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@simplewebauthn/browser")>()),
  WebAuthnAbortService: { cancelCeremony },
}));

describe("cancelPasskeyCeremony", () => {
  beforeEach(() => {
    cancelCeremony.mockClear();
  });

  it("aborts the active SimpleWebAuthn ceremony", () => {
    cancelPasskeyCeremony();

    expect(cancelCeremony).toHaveBeenCalledOnce();
  });
});
