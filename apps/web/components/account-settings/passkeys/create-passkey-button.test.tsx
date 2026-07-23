import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { CreatePasskeyButton } from "./create-passkey-button";

describe("CreatePasskeyButton", () => {
  it("triggers passkey creation on click without a success toast", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    const user = userEvent.setup();
    render(<CreatePasskeyButton />);

    await user.click(screen.getByRole("button", { name: "passkeys.add" }));

    await waitFor(() => expect(authClient.passkey.addPasskey).toHaveBeenCalledWith({}));
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows a spinner and disables the button while the ceremony is in flight", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockReturnValue(new Promise(() => undefined) as never);
    const user = userEvent.setup();
    render(<CreatePasskeyButton />);

    const button = screen.getByRole("button", { name: "passkeys.add" });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
  });

  it("shows a destructive toast when the ceremony fails", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: { message: "cancelled" },
    } as never);
    const user = userEvent.setup();
    render(<CreatePasskeyButton />);

    await user.click(screen.getByRole("button", { name: "passkeys.add" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "passkeys.addError",
        variant: "destructive",
      }),
    );
  });

  it("shows a destructive toast when the client returns no response", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    render(<CreatePasskeyButton />);

    await user.click(screen.getByRole("button", { name: "passkeys.add" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "passkeys.addError",
        variant: "destructive",
      }),
    );
  });
});
