import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { AddPasskeyDialog } from "./add-passkey-dialog";

async function openDialog() {
  const user = userEvent.setup();
  render(<AddPasskeyDialog />);
  await user.click(screen.getByRole("button", { name: "passkeys.add" }));
  expect(screen.getByText("passkeys.addTitle")).toBeInTheDocument();
  return user;
}

describe("AddPasskeyDialog", () => {
  beforeEach(() => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({ data: null, error: null });
  });

  it("requires a name before registering", async () => {
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "passkeys.addConfirm" }));

    await waitFor(() => expect(screen.getByText("passkeys.nameRequired")).toBeInTheDocument());
    expect(authClient.passkey.addPasskey).not.toHaveBeenCalled();
  });

  it("registers the passkey and closes the dialog", async () => {
    const user = await openDialog();

    await user.type(screen.getByPlaceholderText("passkeys.namePlaceholder"), "MacBook");
    await user.click(screen.getByRole("button", { name: "passkeys.addConfirm" }));

    await waitFor(() =>
      expect(authClient.passkey.addPasskey).toHaveBeenCalledWith({ name: "MacBook" }),
    );
    expect(toast).toHaveBeenCalledWith({ description: "passkeys.added" });
    await waitFor(() => expect(screen.queryByText("passkeys.addTitle")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and shows a destructive toast when the ceremony fails", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: { message: "Cancelled" },
    });
    const user = await openDialog();

    await user.type(screen.getByPlaceholderText("passkeys.namePlaceholder"), "MacBook");
    await user.click(screen.getByRole("button", { name: "passkeys.addConfirm" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "passkeys.addError",
        variant: "destructive",
      }),
    );
    expect(authClient.passkey.addPasskey).toHaveBeenCalledWith({ name: "MacBook" });
    expect(screen.getByText("passkeys.addTitle")).toBeInTheDocument();
  });
});
