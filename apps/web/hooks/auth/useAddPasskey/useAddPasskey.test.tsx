import { NOTIFICATIONS_KEY } from "@/hooks/notifications/useNotifications/useNotifications";
import {
  createTestQueryClient,
  render,
  renderHook,
  screen,
  userEvent,
  waitFor,
} from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { Toast, ToastProvider, ToastViewport } from "@repo/ui/components/toast";
import { toast } from "@repo/ui/hooks/use-toast";

import { PasskeySessionTooOldError, useAddPasskey } from "./useAddPasskey";

describe("useAddPasskey", () => {
  it("registers a passkey and invalidates the passkeys query", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddPasskey(), { queryClient });
    const data = await result.current.mutateAsync({ name: "MacBook" });

    expect(authClient.passkey.addPasskey).toHaveBeenCalledWith({ name: "MacBook" });
    expect(data).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "passkeys"] });
  });

  it("calls the caller's onSuccess after refreshing the list", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useAddPasskey({ onSuccess }));
    result.current.mutate({});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(toast).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in when the session is too old, and signs out to the login page", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: {
        code: "SESSION_NOT_FRESH",
        message: "Session is not fresh",
        status: 403,
        statusText: "Forbidden",
      },
    });
    const onError = vi.fn();

    const { result } = renderHook(() => useAddPasskey({ onError }));
    result.current.mutate({});

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "passkeys.sessionTooOld", variant: "destructive" }),
    );
    expect(onError).toHaveBeenCalledWith(expect.any(PasskeySessionTooOldError));

    const { action } = vi.mocked(toast).mock.calls[0]?.[0] ?? {};
    render(
      <ToastProvider>
        <Toast open>{action}</Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "passkeys.signInAgain" }));

    await waitFor(() => expect(useRouter().push).toHaveBeenCalled());
    expect(authClient.signOut).toHaveBeenCalled();
    expect(useRouter().push).toHaveBeenCalledWith(
      "/en-US/login?callbackUrl=%2Fen-US%2Fplatform%2Faccount%2Fsecurity",
    );
  });

  it("shows the generic toast for any other failure, and calls the caller's onError", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: { message: "Ceremony cancelled" },
    } as never);
    const onError = vi.fn();

    const { result } = renderHook(() => useAddPasskey({ onError }));
    result.current.mutate({});

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast).toHaveBeenCalledWith({
      description: "passkeys.addError",
      variant: "destructive",
    });
    expect(onError).toHaveBeenCalledWith(new Error("Ceremony cancelled"));
  });

  it("throws a session-too-old error when Better Auth refuses a stale session", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: {
        code: "SESSION_NOT_FRESH",
        message: "Session is not fresh",
        status: 403,
        statusText: "Forbidden",
      },
    });

    const { result } = renderHook(() => useAddPasskey());

    await expect(result.current.mutateAsync({})).rejects.toBeInstanceOf(PasskeySessionTooOldError);
  });

  it("refreshes the bell, which now holds a notification about the passkey", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddPasskey(), { queryClient });
    await result.current.mutateAsync({});

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: NOTIFICATIONS_KEY });
  });

  it("throws when the response is undefined", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useAddPasskey());

    await expect(result.current.mutateAsync({ name: "Phone" })).rejects.toThrow(
      "Passkey registration returned no response",
    );
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: { message: "Ceremony cancelled" },
    } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddPasskey(), { queryClient });

    const error = await result.current.mutateAsync({ name: "Phone" }).catch((e: unknown) => e);
    expect(error).toEqual(new Error("Ceremony cancelled"));
    expect(error).not.toBeInstanceOf(PasskeySessionTooOldError);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
