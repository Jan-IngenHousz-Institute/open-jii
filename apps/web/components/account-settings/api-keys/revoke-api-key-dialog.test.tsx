import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";

describe("RevokeApiKeyDialog", () => {
  it("confirms and deletes the key by id", async () => {
    vi.mocked(authClient.apiKey.delete).mockResolvedValue({
      data: { success: true },
      error: null,
    });
    const user = userEvent.setup();
    render(<RevokeApiKeyDialog keyId="k1" keyName="CI key" />);

    await user.click(screen.getByRole("button", { name: "apiKeys.revoke" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("apiKeys.revokeTitle")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "apiKeys.revoke" }));

    await waitFor(() => expect(authClient.apiKey.delete).toHaveBeenCalledWith({ keyId: "k1" }));
    expect(toast).toHaveBeenCalledWith({ description: "apiKeys.revoked" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and shows a destructive toast on failure", async () => {
    vi.mocked(authClient.apiKey.delete).mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const user = userEvent.setup();
    render(<RevokeApiKeyDialog keyId="k1" keyName="CI key" />);

    await user.click(screen.getByRole("button", { name: "apiKeys.revoke" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "apiKeys.revoke" }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "apiKeys.revokeError",
        variant: "destructive",
      }),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
