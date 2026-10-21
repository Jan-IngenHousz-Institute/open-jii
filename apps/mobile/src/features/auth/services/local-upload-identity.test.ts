import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalUploadIdentity } from "./local-upload-identity";

const cached = vi.hoisted(() => vi.fn<() => unknown>());
vi.mock("./session-cache", () => ({ getCachedSession: cached }));

describe("local upload identity", () => {
  beforeEach(() => {
    cached.mockReset();
  });
  it("holds rows if secure local session storage cannot be read", () => {
    cached.mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    expect(getLocalUploadIdentity()).toBeNull();
  });
  it.each([true, false])("reads guest=%s locally without a session request", (isAnonymous) => {
    cached.mockReturnValue({
      user: { id: "synthetic", isAnonymous },
      session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
    });
    expect(getLocalUploadIdentity()).toEqual({ userId: "synthetic", isGuest: isAnonymous });
  });
  it.each([
    null,
    {},
    { user: { id: "synthetic" } },
    { user: { id: "synthetic" }, session: { expiresAt: "2020-01-01" } },
  ])("holds an unknown or expired session", (value) => {
    cached.mockReturnValue(value);
    expect(getLocalUploadIdentity()).toBeNull();
  });
});
