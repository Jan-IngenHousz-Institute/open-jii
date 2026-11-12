import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { profileLogin, useAccountInfo } from "./useAccountInfo";

const INFO = {
  user: { id: "583231", name: "Amara Mensah", email: null, emailVerified: true },
  data: { login: "amensah", id: 583231 },
  account: { id: "row-1", providerId: "github", accountId: "583231" },
};

describe("useAccountInfo", () => {
  it("asks for the row by its row id", async () => {
    vi.mocked(authClient.accountInfo).mockResolvedValue({ data: INFO, error: null });

    const { result } = renderHook(() => useAccountInfo("row-1", true));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authClient.accountInfo).toHaveBeenCalledWith({ query: { accountId: "row-1" } });
    expect(profileLogin(result.current.data?.data)).toBe("amensah");
  });

  it("does not ask while disabled", () => {
    renderHook(() => useAccountInfo("row-1", false));

    expect(authClient.accountInfo).not.toHaveBeenCalled();
  });

  it("gives up after one failed lookup", async () => {
    vi.mocked(authClient.accountInfo).mockResolvedValue({
      data: null,
      error: { message: "Access token not found", status: 400, statusText: "Bad Request" },
    });

    const { result } = renderHook(() => useAccountInfo("row-1", true));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(authClient.accountInfo).toHaveBeenCalledOnce();
  });
});

describe("profileLogin", () => {
  it("reads a string login and nothing else", () => {
    expect(profileLogin({ login: "amensah" })).toBe("amensah");
    expect(profileLogin({ login: 7 })).toBeUndefined();
    expect(profileLogin({})).toBeUndefined();
    expect(profileLogin(undefined)).toBeUndefined();
  });
});
