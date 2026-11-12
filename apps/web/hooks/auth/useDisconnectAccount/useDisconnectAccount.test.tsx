import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { useDisconnectAccount } from "./useDisconnectAccount";

function refuse(code: string | undefined, status = 400) {
  vi.mocked(authClient.unlinkAccount).mockResolvedValue({
    data: null,
    error: { code, message: "Refused", status, statusText: "Refused" },
  });
}

describe("useDisconnectAccount", () => {
  it("unlinks the row by its row id and refreshes the list", async () => {
    vi.mocked(authClient.unlinkAccount).mockResolvedValue({
      data: { status: true },
      error: null,
    });
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDisconnectAccount(), { queryClient });
    await result.current.mutateAsync({ accountId: "row-1", provider: "github" });

    expect(authClient.unlinkAccount).toHaveBeenCalledWith({ accountId: "row-1" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "accounts"] });
    expect(toast).not.toHaveBeenCalled();
  });

  it("offers a fresh sign-in when the session is too old", async () => {
    refuse("SESSION_NOT_FRESH", 403);

    const { result } = renderHook(() => useDisconnectAccount());
    result.current.mutate({ accountId: "row-1", provider: "github" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "signInMethods.sessionTooOld",
        variant: "destructive",
      }),
    );
    expect(vi.mocked(toast).mock.calls[0]?.[0].action).toBeDefined();
  });

  it("says the only way in cannot go when the server refuses it", async () => {
    refuse("LAST_SIGN_IN_METHOD");

    const { result } = renderHook(() => useDisconnectAccount());
    result.current.mutate({ accountId: "row-1", provider: "orcid" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({
      description: "signInMethods.lastSignInMethod",
      variant: "destructive",
    });
  });

  it("names the provider for any other failure", async () => {
    refuse(undefined, 500);

    const { result } = renderHook(() => useDisconnectAccount());
    result.current.mutate({ accountId: "row-1", provider: "orcid" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({
      description: "signInMethods.disconnectError:ORCID",
      variant: "destructive",
    });
  });
});
