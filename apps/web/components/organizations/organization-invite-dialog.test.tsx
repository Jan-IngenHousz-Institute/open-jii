import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationInviteDialog } from "./organization-invite-dialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof OrganizationInviteDialog>> = {},
) {
  const onOpenChange = vi.fn();
  const result = render(
    <OrganizationInviteDialog
      organizationId="11111111-1111-4111-8111-111111111111"
      open
      onOpenChange={onOpenChange}
      invitableRoles={["admin", "member"]}
      memberUserIds={[]}
      memberEmails={[]}
      pendingInvitationEmails={[]}
      {...overrides}
    />,
  );
  return { ...result, onOpenChange };
}

const invite = () => vi.mocked(authClient.organization.inviteMember);
const search = () => screen.getByLabelText("organizations.invite.searchLabel");

/** Point the user search at one registered person. */
function mountUserSearch(overrides: Parameters<typeof createUserProfile>[0] = {}) {
  return server.mount(contract.users.searchUsers, {
    body: [
      createUserProfile({
        userId: "22222222-2222-4222-8222-222222222222",
        firstName: "Lin",
        lastName: "Zhao",
        email: "lin@uni.edu",
        ...overrides,
      }),
    ],
  });
}

describe("<OrganizationInviteDialog />", () => {
  afterEach(() => {
    invite().mockResolvedValue({ data: null, error: null });
  });

  it("refuses to submit until somebody is picked", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "organizations.invite.submit" })).toBeDisabled();
  });

  /**
   * The wire, per role. Nobody joins an organization they did not ask to join, so a
   * registered pick is invited at their own address exactly like a typed one — `member`
   * included, which is the row that used to be an instant add.
   */
  it.each(["member", "admin", "owner"])(
    "invites a registered pick at %s rather than adding them",
    async (role) => {
      const user = userEvent.setup();
      mountUserSearch();
      const { onOpenChange } = renderDialog({ invitableRoles: ["owner", "admin", "member"] });

      await user.type(search(), "lin");
      await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
      await user.click(screen.getByText("Lin Zhao"));

      if (role !== "member") {
        await user.click(screen.getByRole("combobox", { name: /roleLabel/u }));
        await user.click(screen.getByRole("option", { name: `organizations.roles.${role}` }));
      }

      // Said before the click, not discovered after it.
      expect(screen.getByText("organizations.invite.mustAccept")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "organizations.invite.submit" }));

      await waitFor(() => {
        expect(invite()).toHaveBeenCalledWith({
          organizationId: "11111111-1111-4111-8111-111111111111",
          email: "lin@uni.edu",
          role,
        });
      });
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "organizations.invite.sent" }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    },
  );

  it("sends an invitation for an address no account matches", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, { body: [] });
    const { onOpenChange } = renderDialog();

    await user.type(search(), "stranger@uni.edu");
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.sendByEmail")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("organizations.invite.sendByEmail"));

    // The affordance itself changes: this one is sent and waited on.
    await user.click(screen.getByRole("button", { name: "organizations.invite.submit" }));

    await waitFor(() => {
      expect(invite()).toHaveBeenCalledWith({
        organizationId: "11111111-1111-4111-8111-111111111111",
        email: "stranger@uni.edu",
        role: "member",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
    // Only owners make owners, so an admin's dialog must not list it.
    expect(
      within(options).queryByRole("option", { name: "organizations.roles.owner" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the dialog and the pick when the invitation is refused", async () => {
    const user = userEvent.setup();
    mountUserSearch();
    invite().mockResolvedValue({
      data: null,
      error: { message: "This person is already a member of this organization" },
    });
    const { onOpenChange } = renderDialog();

    await user.type(search(), "lin");
    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    await user.click(screen.getByText("Lin Zhao"));
    await user.click(screen.getByRole("button", { name: "organizations.invite.submit" }));

    await waitFor(() => {
      // The server's own wording: the reason is the actionable part, and the
      // client does not restate its rules.
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "This person is already a member of this organization",
          variant: "destructive",
        }),
      );
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(search()).toHaveValue("Lin Zhao");
  });

  it("keeps the dialog and the address when the invitation is refused", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, { body: [] });
    invite().mockResolvedValue({
      data: null,
      error: { message: "You cannot invite members to a personal workspace" },
    });
    const { onOpenChange } = renderDialog();

    await user.type(search(), "stranger@uni.edu");
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.sendByEmail")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("organizations.invite.sendByEmail"));
    await user.click(screen.getByRole("button", { name: "organizations.invite.submit" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "You cannot invite members to a personal workspace",
          variant: "destructive",
        }),
      );
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(search()).toHaveValue("stranger@uni.edu");
  });
});
