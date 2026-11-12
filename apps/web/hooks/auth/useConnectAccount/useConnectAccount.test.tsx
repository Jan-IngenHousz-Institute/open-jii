import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { env } from "~/env";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { useConnectAccount } from "./useConnectAccount";

const SECURITY = `${env.NEXT_PUBLIC_BASE_URL}/en-US/platform/account/security`;

describe("useConnectAccount", () => {
  it("asks Better Auth to link the provider, back to Security either way", async () => {
    vi.mocked(authClient.linkSocial).mockResolvedValue({
      data: { url: "https://github.com/login/oauth/authorize", redirect: true },
      error: null,
    });

    const { result } = renderHook(() => useConnectAccount());
    result.current.mutate("orcid");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authClient.linkSocial).toHaveBeenCalledWith({
      provider: "orcid",
      callbackURL: `${SECURITY}?connected=orcid`,
      errorCallbackURL: `${SECURITY}?connect=orcid`,
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it("offers a fresh sign-in when the session is too old", async () => {
    vi.mocked(authClient.linkSocial).mockResolvedValue({
      data: null,
      error: {
        code: "SESSION_NOT_FRESH",
        message: "Session is not fresh",
        status: 403,
        statusText: "Forbidden",
      },
    });

    const { result } = renderHook(() => useConnectAccount());
    result.current.mutate("github");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "signInMethods.sessionTooOld",
        variant: "destructive",
      }),
    );
    expect(vi.mocked(toast).mock.calls[0]?.[0].action).toBeDefined();
  });

  it("says connecting did not finish for any other refusal", async () => {
    vi.mocked(authClient.linkSocial).mockResolvedValue({
      data: null,
      error: { message: "Provider not found", status: 404, statusText: "Not Found" },
    });

    const { result } = renderHook(() => useConnectAccount());
    result.current.mutate("github");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({
      description: "signInMethods.connectDidNotFinish:GitHub",
      variant: "destructive",
    });
  });
});
