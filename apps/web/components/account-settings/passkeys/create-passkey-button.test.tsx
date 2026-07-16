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
});
