import { renderHook, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";

import { authClient, useSession } from "@repo/auth/client";

import { useSignInMethods } from "./useSignInMethods";

function signedInAs(user: { email: string; emailVerified: boolean } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user, session: {} } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

describe("useSignInMethods", () => {
  beforeEach(() => {
    signedInAs({ email: "researcher@example.com", emailVerified: true });
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [{ id: "pk-1" }],
      error: null,
    });
    vi.mocked(authClient.listAccounts).mockResolvedValue({
      data: [{ id: "row-1", providerId: "orcid", accountId: "0000-0002-1825-0097" }],
      error: null,
    });
  });

  afterEach(() => {
    signedInAs(null);
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({ data: [], error: null });
  });

  it("puts the session, the passkeys and the account rows together", async () => {
    const { result } = renderHook(() => useSignInMethods());

    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual({
      email: "researcher@example.com",
      emailVerified: true,
      passkeyCount: 1,
      accountIds: ["row-1"],
    });
  });

  it("stays undefined while the accounts are still loading", async () => {
    vi.mocked(authClient.listAccounts).mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => ({
      methods: useSignInMethods(),
      passkeys: usePasskeys(),
    }));

    await waitFor(() => expect(result.current.passkeys.isSuccess).toBe(true));
    expect(result.current.methods).toBeUndefined();
  });

  it("stays undefined without a session", async () => {
    signedInAs(null);

    const { result } = renderHook(() => useSignInMethods());

    await waitFor(() => expect(authClient.listAccounts).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
