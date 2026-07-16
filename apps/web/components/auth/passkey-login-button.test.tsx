import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { PasskeyLoginButton } from "./passkey-login-button";

describe("PasskeyLoginButton", () => {
  beforeEach(() => {
    vi.mocked(authClient.signIn.passkey).mockResolvedValue({ data: null, error: null } as never);
  });

  it("signs in with a passkey and redirects to the callback URL", async () => {
    const user = userEvent.setup();
    const { router } = render(<PasskeyLoginButton callbackUrl="/cb" />);

    await user.click(screen.getByRole("button", { name: "auth.loginWith-passkey" }));

    await waitFor(() => expect(authClient.signIn.passkey).toHaveBeenCalled());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cb"));
  });

  it("falls back to /platform without a callback URL", async () => {
    const user = userEvent.setup();
    const { router } = render(<PasskeyLoginButton callbackUrl={undefined} />);

    await user.click(screen.getByRole("button", { name: "auth.loginWith-passkey" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/platform"));
  });

  it("shows a destructive toast and does not redirect on failure", async () => {
    vi.mocked(authClient.signIn.passkey).mockResolvedValue({
      data: null,
      error: { message: "Cancelled" },
    } as never);
    const user = userEvent.setup();
    const { router } = render(<PasskeyLoginButton callbackUrl="/cb" />);

    await user.click(screen.getByRole("button", { name: "auth.loginWith-passkey" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "auth.passkeyError",
        variant: "destructive",
      }),
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows the last used badge when isLastUsed is set", () => {
    render(<PasskeyLoginButton callbackUrl="/cb" isLastUsed />);

    expect(screen.getByText("auth.lastUsed")).toBeInTheDocument();
  });

  it("hides the last used badge by default", () => {
    render(<PasskeyLoginButton callbackUrl="/cb" />);

    expect(screen.queryByText("auth.lastUsed")).not.toBeInTheDocument();
  });
});
