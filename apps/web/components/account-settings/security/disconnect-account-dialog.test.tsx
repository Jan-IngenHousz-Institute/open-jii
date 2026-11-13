import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { DisconnectAccountDialog } from "./disconnect-account-dialog";

async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "signInMethods.disconnect" }));
  return { user, dialog: within(screen.getByRole("alertdialog")) };
}

describe("DisconnectAccountDialog", () => {
  it("asks first, then unlinks the row by its row id and closes", async () => {
    render(
      <DisconnectAccountDialog
        accountId="github-row"
        provider="github"
        label="amensah"
        disabled={false}
      />,
    );

    const { user, dialog } = await openDialog();
    expect(dialog.getByText("signInMethods.disconnectTitle:GitHub")).toBeInTheDocument();
    expect(dialog.getByText("signInMethods.disconnectConfirmGithub:amensah")).toBeInTheDocument();
    expect(authClient.unlinkAccount).not.toHaveBeenCalled();

    await user.click(dialog.getByRole("button", { name: "signInMethods.disconnect" }));

    await waitFor(() =>
      expect(authClient.unlinkAccount).toHaveBeenCalledWith({ accountId: "github-row" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("names the ORCID iD being disconnected", async () => {
    render(
      <DisconnectAccountDialog
        accountId="orcid-row"
        provider="orcid"
        label="0000-0002-1825-0097"
        disabled={false}
      />,
    );

    const { dialog } = await openDialog();

    expect(dialog.getByText("signInMethods.disconnectTitle:ORCID")).toBeInTheDocument();
    expect(
      dialog.getByText("signInMethods.disconnectConfirmOrcid:0000-0002-1825-0097"),
    ).toBeInTheDocument();
  });

  it("does without the username when GitHub could not be read", async () => {
    render(
      <DisconnectAccountDialog
        accountId="github-row"
        provider="github"
        label={undefined}
        disabled={false}
      />,
    );

    const { dialog } = await openDialog();

    expect(dialog.getByText("signInMethods.disconnectConfirmGithubUnnamed")).toBeInTheDocument();
  });

  it("stays open when the server refuses", async () => {
    vi.mocked(authClient.unlinkAccount).mockResolvedValue({
      data: null,
      error: {
        code: "LAST_SIGN_IN_METHOD",
        message: "This is the only way to sign in",
        status: 400,
        statusText: "Bad Request",
      },
    });
    render(
      <DisconnectAccountDialog
        accountId="orcid-row"
        provider="orcid"
        label="0000-0002-1825-0097"
        disabled={false}
      />,
    );

    const { user, dialog } = await openDialog();
    await user.click(dialog.getByRole("button", { name: "signInMethods.disconnect" }));

    await waitFor(() => expect(authClient.unlinkAccount).toHaveBeenCalled());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("cannot be opened while disabled", () => {
    render(
      <DisconnectAccountDialog
        accountId="orcid-row"
        provider="orcid"
        label="0000-0002-1825-0097"
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: "signInMethods.disconnect" })).toBeDisabled();
  });
});
