import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationInviteDialog } from "./organization-invite-dialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof OrganizationInviteDialog>> = {},
) {
  const onOpenChange = vi.fn();
  const result = render(
    <OrganizationInviteDialog
      organizationId="org-1"
      open
      onOpenChange={onOpenChange}
      invitableRoles={["admin", "member"]}
      existingEmails={[]}
      {...overrides}
    />,
  );
  return { ...result, onOpenChange };
}

const invite = () => vi.mocked(authClient.organization.inviteMember);

describe("<OrganizationInviteDialog />", () => {
  afterEach(() => {
    invite().mockResolvedValue({ data: null, error: null });
  });

  it("refuses to submit until an address is a valid one", async () => {
    const user = userEvent.setup();
    renderDialog();

    const submit = screen.getByRole("button", { name: "organizations.invite.submit" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("organizations.invite.emailLabel"), "not-an-email");
    expect(screen.getByText("organizations.invite.invalidEmail")).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.clear(screen.getByLabelText("organizations.invite.emailLabel"));
    await user.type(screen.getByLabelText("organizations.invite.emailLabel"), "ada@example.com");
    expect(submit).toBeEnabled();
  });

  it("refuses an address that is already a member or already invited", async () => {
    const user = userEvent.setup();
    renderDialog({ existingEmails: ["Ada@Example.com"] });

    // Case-insensitively: an address is the same address whatever its casing.
    await user.type(screen.getByLabelText("organizations.invite.emailLabel"), "ada@example.com");

    expect(screen.getByText("organizations.invite.alreadyPresent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "organizations.invite.submit" })).toBeDisabled();
  });

  it("offers only the roles the actor may hand out", async () => {
    const user = userEvent.setup();
    renderDialog({ invitableRoles: ["admin", "member"] });

    await user.click(screen.getByRole("combobox", { name: /roleLabel/u }));
    const options = screen.getByRole("listbox");

    expect(
      within(options).getByRole("option", { name: "organizations.roles.admin" }),
    ).toBeVisible();
    expect(
      within(options).getByRole("option", { name: "organizations.roles.member" }),
    ).toBeVisible();
    // Only owners grant the owner role, so an admin's dialog must not list it.
    expect(
      within(options).queryByRole("option", { name: "organizations.roles.owner" }),
    ).not.toBeInTheDocument();
  });

  it("sends the invitation and closes on success", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.type(screen.getByLabelText("organizations.invite.emailLabel"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "organizations.invite.submit" }));

    await waitFor(() => {
      expect(invite()).toHaveBeenCalledWith({
        organizationId: "org-1",
        email: "ada@example.com",
        role: "member",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog and the typed address when the server refuses", async () => {
    const user = userEvent.setup();
    invite().mockResolvedValue({
      data: null,
      error: { message: "You cannot invite members to a personal workspace" },
    });
    const { onOpenChange } = renderDialog();

    await user.type(screen.getByLabelText("organizations.invite.emailLabel"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "organizations.invite.submit" }));

    await waitFor(() => {
      // The server's own wording, not a generic failure: the reason is the
      // actionable part and the client does not restate its rules.
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "You cannot invite members to a personal workspace",
          variant: "destructive",
        }),
      );
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("organizations.invite.emailLabel")).toHaveValue("ada@example.com");
  });
});
