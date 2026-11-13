import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeletePasskeyDialog } from "./delete-passkey-dialog";

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
    i18n: { language: "en-US", changeLanguage: vi.fn() },
  }),
}));

describe("DeletePasskeyDialog", () => {
  it("confirms and deletes the passkey by id without a success toast", async () => {
    vi.mocked(authClient.passkey.deletePasskey).mockResolvedValue({
      data: null,
      error: null,
    });
    const user = userEvent.setup();
    render(<DeletePasskeyDialog passkeyId="p1" passkeyName="Work laptop" />);

    await user.click(screen.getByRole("button", { name: "passkeys.deleteNamed:Work laptop" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("passkeys.deleteTitle")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "passkeys.delete" }));

    await waitFor(() =>
      expect(authClient.passkey.deletePasskey).toHaveBeenCalledWith({ id: "p1" }),
    );
    expect(toast).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and shows a destructive toast on failure", async () => {
    vi.mocked(authClient.passkey.deletePasskey).mockResolvedValue({
      data: null,
      error: { message: "nope" },
    });
    const user = userEvent.setup();
    render(<DeletePasskeyDialog passkeyId="p1" passkeyName="Work laptop" />);

    await user.click(screen.getByRole("button", { name: "passkeys.deleteNamed:Work laptop" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "passkeys.delete" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "passkeys.deleteError",
        variant: "destructive",
      }),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("says the only way in cannot go when the server refuses it", async () => {
    vi.mocked(authClient.passkey.deletePasskey).mockResolvedValue({
      data: null,
      error: { code: "LAST_SIGN_IN_METHOD", message: "This is the only way to sign in" },
    });
    const user = userEvent.setup();
    render(<DeletePasskeyDialog passkeyId="p1" passkeyName="Work laptop" />);

    await user.click(screen.getByRole("button", { name: "passkeys.deleteNamed:Work laptop" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "passkeys.delete" }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "signInMethods.lastSignInMethod",
        variant: "destructive",
      }),
    );
  });

  it("cannot be opened while disabled", () => {
    render(<DeletePasskeyDialog passkeyId="p1" passkeyName="Work laptop" disabled />);

    expect(screen.getByRole("button", { name: "passkeys.deleteNamed:Work laptop" })).toBeDisabled();
  });
});
