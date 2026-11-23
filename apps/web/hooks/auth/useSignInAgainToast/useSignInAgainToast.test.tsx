import { render, renderHook, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { Toast, ToastProvider, ToastViewport } from "@repo/ui/components/toast";
import { toast } from "@repo/ui/hooks/use-toast";

import { useSignInAgainToast } from "./useSignInAgainToast";

describe("useSignInAgainToast", () => {
  it("toasts the caller's copy with an action that signs out and returns to Security", async () => {
    const { result } = renderHook(() => useSignInAgainToast());

    result.current("Sign in again first.", "Sign in again");

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Sign in again first.", variant: "destructive" }),
    );
    const { action } = vi.mocked(toast).mock.calls[0]?.[0] ?? {};
    render(
      <ToastProvider>
        <Toast open>{action}</Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() => expect(useRouter().push).toHaveBeenCalled());
    expect(authClient.signOut).toHaveBeenCalled();
    expect(useRouter().push).toHaveBeenCalledWith(
      "/en-US/login?callbackUrl=%2Fen-US%2Fplatform%2Faccount%2Fsecurity",
    );
  });
});
