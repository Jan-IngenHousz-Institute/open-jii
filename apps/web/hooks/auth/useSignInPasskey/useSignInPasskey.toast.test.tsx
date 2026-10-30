import { useMutation } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryProvider } from "~/providers/QueryProvider";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { useSignInPasskey } from "./useSignInPasskey";

describe("passkey error ownership with the application query provider", () => {
  it.each([true, false])("leaves autofill=%s cancellation to the caller", async (autoFill) => {
    vi.mocked(authClient.signIn.passkey).mockResolvedValue({
      data: null,
      error: { message: "Auth cancelled" },
    } as never);
    const { result } = renderHook(() => useSignInPasskey(), { wrapper: QueryProvider });

    await act(async () => {
      await expect(result.current.mutateAsync({ autoFill })).rejects.toThrow("Auth cancelled");
    });

    expect(toast).not.toHaveBeenCalled();
  });

  it("keeps the global error toast for mutations without a local error owner", async () => {
    const { result } = renderHook(
      () => useMutation({ mutationFn: async () => Promise.reject(new Error("Write failed")) }),
      { wrapper: QueryProvider },
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow("Write failed");
    });

    expect(toast).toHaveBeenCalledWith({ title: "Error", variant: "destructive" });
  });
});
