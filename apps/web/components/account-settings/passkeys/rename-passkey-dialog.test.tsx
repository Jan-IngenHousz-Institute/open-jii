import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { RenamePasskeyDialog } from "./rename-passkey-dialog";

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
    i18n: { language: "en-US", changeLanguage: vi.fn() },
  }),
}));

describe("RenamePasskeyDialog", () => {
  it("renames the passkey and closes without a success toast", async () => {
    vi.mocked(authClient.passkey.updatePasskey).mockResolvedValue({
      data: null,
      error: null,
    });
    const user = userEvent.setup();
    render(<RenamePasskeyDialog passkeyId="p1" currentName="Old name" />);

    await user.click(screen.getByRole("button", { name: "passkeys.renameNamed:Old name" }));
    const input = screen.getByRole("textbox", { name: "passkeys.name" });
    await user.clear(input);
    await user.type(input, "New name");
    await user.click(screen.getByRole("button", { name: "passkeys.rename" }));

    await waitFor(() =>
      expect(authClient.passkey.updatePasskey).toHaveBeenCalledWith({
        id: "p1",
        name: "New name",
      }),
    );
    expect(toast).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("disables submit when the name is blank", async () => {
    const user = userEvent.setup();
    render(<RenamePasskeyDialog passkeyId="p1" currentName="Keeper" />);

    await user.click(screen.getByRole("button", { name: "passkeys.renameNamed:Keeper" }));
    const input = screen.getByRole("textbox", { name: "passkeys.name" });
    await user.clear(input);

    // Radix marks the trigger aria-hidden while the modal is open, so the only
    // accessible "passkeys.rename" button is the footer submit.
    expect(screen.getByRole("button", { name: "passkeys.rename" })).toBeDisabled();
  });

  it("keeps the dialog open and shows a destructive toast on failure", async () => {
    vi.mocked(authClient.passkey.updatePasskey).mockResolvedValue({
      data: null,
      error: { message: "nope" },
    });
    const user = userEvent.setup();
    render(<RenamePasskeyDialog passkeyId="p1" currentName="Old name" />);

    await user.click(screen.getByRole("button", { name: "passkeys.renameNamed:Old name" }));
    await user.click(screen.getByRole("button", { name: "passkeys.rename" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "passkeys.renameError",
        variant: "destructive",
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
