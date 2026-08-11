import { createOrganizationMember } from "@/test/factories";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrganizationMember } from "@repo/api/domains/organization/organization.schema";
import { authClient, useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationRoster } from "./organization-roster";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

const listMembers = () => vi.mocked(authClient.organization.listMembers);
const updateRole = () => vi.mocked(authClient.organization.updateMemberRole);
const removeMember = () => vi.mocked(authClient.organization.removeMember);

/**
 * The Better Auth member rows the roster is joined against for their row ids —
 * the one thing the profile-joined roster endpoint does not carry.
 */
function mockMemberRows(members: OrganizationMember[]) {
  listMembers().mockResolvedValue({
    data: {
      members: members.map((member) => ({
        id: `member-row-${member.userId}`,
        userId: member.userId,
        organizationId: "org-1",
        role: member.role,
      })),
      total: members.length,
    },
    error: null,
  });
}

const ownerRow = createOrganizationMember({
  userId: "user-owner",
  firstName: "Ada",
  lastName: "Lovelace",
  role: "owner",
});
const secondOwnerRow = createOrganizationMember({
  userId: "user-owner-2",
  firstName: "Alan",
  lastName: "Turing",
  role: "owner",
});
const memberRow = createOrganizationMember({
  userId: "user-member",
  firstName: "Grace",
  lastName: "Hopper",
  role: "member",
});

function renderRoster(
  members: OrganizationMember[],
  overrides: Partial<React.ComponentProps<typeof OrganizationRoster>> = {},
) {
  mockMemberRows(members);
  return render(
    <OrganizationRoster
      organizationId="org-1"
      members={members}
      actorRole="owner"
      isPending={false}
      isError={false}
      {...overrides}
    />,
  );
}

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('[role="listitem"]');
  if (!row) throw new Error(`No roster row found for ${name}`);
  return row as HTMLElement;
}

/**
 * The row's role dropdown once it exists. It appears only after the Better Auth
 * member rows resolve — until then there is no row id for it to address — so
 * waiting for it is part of what these tests assert.
 */
async function roleSelectFor(name: string): Promise<HTMLElement> {
  return within(rowFor(name)).findByRole("combobox");
}

describe("<OrganizationRoster />", () => {
  afterEach(() => {
    mockSession(null);
    updateRole().mockResolvedValue({ data: null, error: null });
    removeMember().mockResolvedValue({ data: null, error: null });
    listMembers().mockResolvedValue({ data: { members: [], total: 0 }, error: null });
  });

  it("gives a plain member a read-only roster", async () => {
    mockSession({ id: "user-member" });
    renderRoster([ownerRow, memberRow], { actorRole: "member" });

    await screen.findByText("Ada Lovelace");
    const row = within(rowFor("Ada Lovelace"));
    expect(row.queryByRole("combobox")).not.toBeInTheDocument();
    // Not permitted is rendered as no control at all, not a disabled one.
    expect(row.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets an admin manage members but not owners", async () => {
    mockSession({ id: "user-admin" });
    renderRoster(
      [
        ownerRow,
        memberRow,
        createOrganizationMember({
          userId: "user-admin",
          firstName: "Barbara",
          lastName: "Liskov",
          role: "admin",
        }),
      ],
      { actorRole: "admin" },
    );

    expect(await roleSelectFor("Grace Hopper")).toBeVisible();
    // An admin cannot touch an owner in either direction.
    const owner = within(rowFor("Ada Lovelace"));
    expect(owner.queryByRole("combobox")).not.toBeInTheDocument();
    expect(owner.queryByRole("button")).not.toBeInTheDocument();
  });

  it("only lets an owner hand out the owner role", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-owner" });
    renderRoster([ownerRow, memberRow], { actorRole: "owner" });

    await user.click(await roleSelectFor("Grace Hopper"));

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "organizations.roles.owner",
      "organizations.roles.admin",
      "organizations.roles.member",
    ]);
  });

  it("disables the last owner's removal and leave with the reason, rather than hiding them", async () => {
    mockSession({ id: "user-owner" });
    renderRoster([ownerRow, memberRow], { actorRole: "owner" });

    await screen.findByText("Ada Lovelace");
    // Wait for the member rows so the absence below is a decision, not a race.
    await waitFor(() => {
      expect(listMembers()).toHaveBeenCalled();
    });
    const own = within(rowFor("Ada Lovelace"));

    // The sole owner's own row: the reason travels as the accessible name, because
    // an absent control would read as a bug instead of as the invariant it is.
    const leave = own.getByRole("button", { name: /lastOwnerLeaveReason/u });
    expect(leave).toBeDisabled();
    // Their role dropdown is gone too: demoting the last owner strands the org.
    expect(own.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("opens up the owner controls once a second owner exists", async () => {
    mockSession({ id: "user-owner" });
    renderRoster([ownerRow, secondOwnerRow], { actorRole: "owner" });

    expect(await roleSelectFor("Alan Turing")).toBeVisible();
    expect(
      within(rowFor("Alan Turing")).getByRole("button", { name: /removeForLabel/u }),
    ).toBeEnabled();
  });

  it("addresses a role change by the Better Auth member row id, not the user id", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-owner" });
    renderRoster([ownerRow, memberRow], { actorRole: "owner" });

    await user.click(await roleSelectFor("Grace Hopper"));
    await user.click(screen.getByRole("option", { name: "organizations.roles.admin" }));

    await waitFor(() => {
      expect(updateRole()).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberId: "member-row-user-member",
        role: "admin",
      });
    });
  });

  it("offers no role control while the member row it would address is unresolved", async () => {
    mockSession({ id: "user-owner" });
    // The roster resolved but the Better Auth rows did not: a control here would
    // have nothing to address, or would address the wrong row.
    listMembers().mockResolvedValue({ data: { members: [], total: 0 }, error: null });
    render(
      <OrganizationRoster
        organizationId="org-1"
        members={[ownerRow, memberRow]}
        actorRole="owner"
        isPending={false}
        isError={false}
      />,
    );

    await screen.findByText("Grace Hopper");
    expect(within(rowFor("Grace Hopper")).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("surfaces a raced server refusal verbatim", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-owner" });
    updateRole().mockResolvedValue({
      data: null,
      error: { message: "You are not allowed to update this member" },
    });
    renderRoster([ownerRow, memberRow], { actorRole: "owner" });

    await user.click(await roleSelectFor("Grace Hopper"));
    await user.click(screen.getByRole("option", { name: "organizations.roles.admin" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "You are not allowed to update this member",
          variant: "destructive",
        }),
      );
    });
  });

  it("confirms a removal and says the grants survive it", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-owner" });
    renderRoster([ownerRow, memberRow], { actorRole: "owner" });

    await screen.findByText("Grace Hopper");
    await user.click(
      within(rowFor("Grace Hopper")).getByRole("button", { name: /removeForLabel/u }),
    );

    expect(screen.getByText("organizations.members.removeNote")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "common.remove" }));

    await waitFor(() => {
      expect(removeMember()).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberIdOrEmail: "member-row-user-member",
      });
    });
  });
});
