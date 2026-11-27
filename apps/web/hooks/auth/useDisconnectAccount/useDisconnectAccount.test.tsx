import { useGetUserProfile } from "@/hooks/profile/useGetUserProfile/useGetUserProfile";
import { createUserProfileResponse } from "@/test/factories";
import { server } from "@/test/msw/server";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { FRESH_FOR_MS } from "~/providers/QueryProvider";

import { contract } from "@repo/api/contract";
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

  it("refetches the profile, which a fresh query would otherwise keep showing", async () => {
    vi.mocked(authClient.unlinkAccount).mockResolvedValue({
      data: { status: true },
      error: null,
    });
    const profile = createUserProfileResponse({ orcidId: "0000-0002-1825-0097" });
    server.mount(contract.users.getUserProfile, { body: profile });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: FRESH_FOR_MS, retry: false } },
    });

    const { result } = renderHook(
      () => ({ profile: useGetUserProfile("u-1"), disconnect: useDisconnectAccount() }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.profile.data?.orcidId).toBe("0000-0002-1825-0097"));

    server.mount(contract.users.getUserProfile, { body: createUserProfileResponse() });
    await result.current.disconnect.mutateAsync({ accountId: "row-1", provider: "orcid" });

    await waitFor(() => expect(result.current.profile.data?.orcidId).toBeNull());
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
