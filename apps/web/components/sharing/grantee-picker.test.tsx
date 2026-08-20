import { createGranteeUser } from "@/test/factories";
import { server } from "@/test/msw/server";
import { createTestQueryClient, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import type { GranteeSelection } from "./grantee-picker";
import { GranteePicker } from "./grantee-picker";

function renderPicker(overrides: Partial<React.ComponentProps<typeof GranteePicker>> = {}) {
  const onSelectionChange = vi.fn();
  const result = render(
    <GranteePicker
      resourceType="experiment"
      resourceId="exp-1"
      role="viewer"
      selection={null}
      onSelectionChange={onSelectionChange}
      {...overrides}
    />,
  );
  return { ...result, onSelectionChange };
}

/** Point the globally-mocked `useSession` at a given principal. */
function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

describe("<GranteePicker />", () => {
  afterEach(() => {
    mockSession(null);
  });

  it("reports the picked user as a grantee selection", async () => {
    const user = userEvent.setup();
    server.mount(contract.sharing.searchGranteeUsers, {
      body: [
        createGranteeUser({
          userId: "u-1",
          firstName: "Lin",
          lastName: "Zhao",
          email: "lin@uni.edu",
        }),
      ],
    });

    const { onSelectionChange } = renderPicker();

    await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "lin");

    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.getByText("lin@uni.edu")).toBeInTheDocument();

    await user.click(screen.getByText("Lin Zhao"));

    expect(onSelectionChange.mock.lastCall?.[0]).toMatchObject({
      kind: "grantee",
      grantee: { type: "user", id: "u-1", displayName: "Lin Zhao" },
    });
  });

  it("switches to organization grantees and lists the caller's organizations", async () => {
    const user = userEvent.setup();
    const orgSpy = server.mount(contract.sharing.searchGranteeOrganizations, {
      body: [{ id: "org-1", name: "Greenhouse Lab", slug: "greenhouse-lab" }],
    });

    const { onSelectionChange } = renderPicker();

    await user.click(screen.getByLabelText("sharing.granteeTypeLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.granteeTypeOrganization" }));

    // Organizations are browsable (scoped to the caller's memberships), so the
    // list appears on focus without a search term.
    await user.click(screen.getByLabelText("sharing.granteeSearchLabel"));

    await waitFor(() => expect(orgSpy.called).toBe(true));
    await waitFor(() => expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument());

    await user.click(screen.getByText("Greenhouse Lab"));

    expect(onSelectionChange.mock.lastCall?.[0]).toMatchObject({
      kind: "grantee",
      grantee: { type: "organization", id: "org-1", displayName: "Greenhouse Lab" },
    });
  });

  describe("access someone already holds", () => {
    /** The row's clickable button, which is what carries the disabled state. */
    function rowFor(name: string): HTMLElement {
      const row = screen.getByText(name).closest("button");
      if (!row) throw new Error(`No result row for ${name}`);
      return row;
    }

    it("shows an existing grantee with their tier, unselectable at the same tier", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Already",
            lastName: "Shared",
            existingGrantRole: "viewer",
          }),
          createGranteeUser({ userId: "u-2", firstName: "Not", lastName: "Shared" }),
        ],
      });

      const { onSelectionChange } = renderPicker({ role: "viewer" });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "shared");

      // Shown rather than filtered out: hiding them is what sends people hunting
      // for a name the picker swallowed.
      await waitFor(() => expect(screen.getByText("Already Shared")).toBeInTheDocument());
      expect(screen.getByText("sharing.existingGrantBadge")).toBeInTheDocument();
      expect(screen.getByText("sharing.granteeTierAddsNothing")).toBeInTheDocument();
      expect(rowFor("Already Shared")).toBeDisabled();
      expect(rowFor("Not Shared")).toBeEnabled();

      await user.click(screen.getByText("Already Shared"));
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("keeps a raising tier selectable for an existing viewer", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Already",
            lastName: "Shared",
            existingGrantRole: "viewer",
          }),
        ],
      });

      const { onSelectionChange } = renderPicker({ role: "admin" });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "shared");

      await waitFor(() => expect(screen.getByText("Already Shared")).toBeInTheDocument());
      expect(rowFor("Already Shared")).toBeEnabled();

      await user.click(screen.getByText("Already Shared"));
      expect(onSelectionChange.mock.lastCall?.[0]).toMatchObject({
        kind: "grantee",
        grantee: { id: "u-1" },
      });
    });

    it("shows an organization admin, and lets no tier be granted to them", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Org",
            lastName: "Admin",
            organizationRole: "admin",
          }),
        ],
      });

      // "Can edit" is the most any tier confers, and an org admin already holds it.
      const { onSelectionChange } = renderPicker({ role: "admin" });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "admin");

      await waitFor(() => expect(screen.getByText("Org Admin")).toBeInTheDocument());
      expect(screen.getByText("sharing.orgAdminBadge")).toBeInTheDocument();
      expect(screen.getByText("sharing.granteeHasFullAccess")).toBeInTheDocument();
      expect(rowFor("Org Admin")).toBeDisabled();

      await user.click(screen.getByText("Org Admin"));
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("names the share, not the organization, when a grant is what maxes someone out", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Outside",
            lastName: "Editor",
            organizationRole: null,
            existingGrantRole: "admin",
          }),
        ],
      });

      // No tier can raise them — but that ceiling is their existing share, not a role
      // in an organization they do not belong to. Saying "through the organization"
      // here describes access they simply do not have.
      const { onSelectionChange } = renderPicker({ role: "admin" });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "outside");

      await waitFor(() => expect(screen.getByText("Outside Editor")).toBeInTheDocument());
      expect(screen.getByText("sharing.granteeHasFullAccessViaGrant")).toBeInTheDocument();
      expect(screen.queryByText("sharing.granteeHasFullAccess")).not.toBeInTheDocument();
      expect(rowFor("Outside Editor")).toBeDisabled();

      await user.click(screen.getByText("Outside Editor"));
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("still offers an organization member the tier that raises them", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Org",
            lastName: "Member",
            organizationRole: "member",
          }),
        ],
      });

      // Membership is read-only, so "Can edit" is a real raise — the case that
      // must survive the picker learning about organization roles at all.
      const { onSelectionChange } = renderPicker({ role: "admin" });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "member");

      await waitFor(() => expect(screen.getByText("Org Member")).toBeInTheDocument());
      expect(screen.getByText("sharing.orgMemberBadge")).toBeInTheDocument();
      expect(rowFor("Org Member")).toBeEnabled();

      await user.click(screen.getByText("Org Member"));
      expect(onSelectionChange.mock.lastCall?.[0]).toMatchObject({
        kind: "grantee",
        grantee: { id: "u-1", access: { organizationRole: "member" } },
      });
    });

    it('refuses "Can view" for a member of the organization that owns the experiment', async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Org",
            lastName: "Member",
            organizationRole: "member",
          }),
        ],
      });

      // Membership carries contribution on an experiment, which is all "Can view"
      // confers — so the lowest tier adds nothing to a member of the owning org.
      renderPicker({ resourceType: "experiment", role: "viewer" });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "member");

      await waitFor(() => expect(screen.getByText("Org Member")).toBeInTheDocument());
      expect(screen.getByText("sharing.granteeTierAddsNothing")).toBeInTheDocument();
      expect(rowFor("Org Member")).toBeDisabled();
    });

    it("refuses a tier an organization member's own role already covers", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Org",
            lastName: "Member",
            organizationRole: "member",
          }),
        ],
      });

      // On a protocol "Can view" is read-only, exactly what membership already
      // carries — unlike an experiment, where it adds contribution.
      renderPicker({ resourceType: "protocol", role: "viewer" });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "member");

      await waitFor(() => expect(screen.getByText("Org Member")).toBeInTheDocument());
      expect(screen.getByText("sharing.granteeTierAddsNothing")).toBeInTheDocument();
      expect(rowFor("Org Member")).toBeDisabled();
    });
  });

  describe("a failed read is not an empty one", () => {
    it("says the search failed instead of claiming nobody matches", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, { status: 500 });

      renderPicker();

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "lin");

      await waitFor(() => expect(screen.getByText("sharing.loadFailed")).toBeInTheDocument());
      expect(screen.queryByText("sharing.noUsersFound")).not.toBeInTheDocument();
    });

    it("refuses to offer an email invitation it cannot rule out an account for", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, { status: 500 });

      const { onSelectionChange } = renderPicker({ allowEmailInvite: true });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "lin@uni.edu");

      // Whether that address already has an account is exactly what the failed
      // search cannot answer, and an invitation to one sits pending forever.
      await waitFor(() => expect(screen.getByText("sharing.loadFailed")).toBeInTheDocument());
      expect(screen.queryByText("sharing.sendInviteByEmail")).not.toBeInTheDocument();
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("reports a failed organization search rather than an empty one", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeOrganizations, { status: 500 });

      renderPicker();

      await user.click(screen.getByLabelText("sharing.granteeTypeLabel"));
      await user.click(screen.getByRole("option", { name: "sharing.granteeTypeOrganization" }));
      await user.click(screen.getByLabelText("sharing.granteeSearchLabel"));

      await waitFor(() => expect(screen.getByText("sharing.loadFailed")).toBeInTheDocument());
      expect(screen.queryByText("sharing.noOrganizationsFound")).not.toBeInTheDocument();
    });
  });

  it("does not browse users without a search term", async () => {
    const user = userEvent.setup();
    const userSpy = server.mount(contract.sharing.searchGranteeUsers, { body: [] });

    renderPicker();

    // Unlike organizations, the user directory is not browsable: focusing the
    // input opens nothing and issues no query.
    await user.click(screen.getByLabelText("sharing.granteeSearchLabel"));

    expect(screen.queryByText("sharing.noUsersFound")).not.toBeInTheDocument();
    expect(userSpy.called).toBe(false);
  });

  describe("email invitations", () => {
    it("offers a typed address only when the host allows email invites", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, { body: [] });

      const { onSelectionChange } = renderPicker();

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "new@uni.edu");

      // A macro or workbook has nowhere to park a pending invitation.
      await waitFor(() => expect(screen.getByText("sharing.noUsersFound")).toBeInTheDocument());
      expect(screen.queryByText("sharing.sendInviteByEmail")).not.toBeInTheDocument();
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("reports a typed address as an email selection", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, { body: [] });

      const { onSelectionChange } = renderPicker({ allowEmailInvite: true });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "new@uni.edu");

      await waitFor(() =>
        expect(screen.getByText("sharing.sendInviteByEmail")).toBeInTheDocument(),
      );
      await user.click(screen.getByText("sharing.sendInviteByEmail"));

      expect(onSelectionChange).toHaveBeenCalledWith({ kind: "email", email: "new@uni.edu" });
    });

    it("does not re-offer an address that already has a pending invitation", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, { body: [] });

      renderPicker({ allowEmailInvite: true, existingEmails: ["Pending@Uni.edu"] });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "pending@uni.edu");

      await waitFor(() =>
        expect(screen.getByText("sharing.emailAlreadyInvited")).toBeInTheDocument(),
      );
      expect(screen.queryByText("sharing.sendInviteByEmail")).not.toBeInTheDocument();
    });

    it("offers the account, not an invitation, for a registered address", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Lin",
            lastName: "Zhao",
            email: "lin@uni.edu",
          }),
        ],
      });

      const { onSelectionChange } = renderPicker({ allowEmailInvite: true });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "lin@uni.edu");

      // An invitation to an existing account would sit pending forever — the
      // account is grantable right now, so only that row is offered.
      await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
      expect(screen.queryByText("sharing.sendInviteByEmail")).not.toBeInTheDocument();

      await user.click(screen.getByText("Lin Zhao"));
      expect(onSelectionChange.mock.lastCall?.[0]).toMatchObject({
        kind: "grantee",
        grantee: { id: "u-1" },
      });
    });

    it("shows the account that already holds access rather than offering to invite it", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [
          createGranteeUser({
            userId: "u-1",
            firstName: "Lin",
            lastName: "Zhao",
            email: "lin@uni.edu",
            organizationRole: "owner",
          }),
        ],
      });

      renderPicker({ allowEmailInvite: true });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "lin@uni.edu");

      // An invitation to an address that already has an account would sit pending
      // forever, and the row itself now says why nothing can be granted to it.
      await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
      expect(screen.getByText("sharing.granteeHasFullAccess")).toBeInTheDocument();
      expect(screen.queryByText("sharing.sendInviteByEmail")).not.toBeInTheDocument();
      expect(screen.queryByText("sharing.noUsersFound")).not.toBeInTheDocument();
    });

    it("never offers an email invite on the organization side", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.searchGranteeOrganizations, { body: [] });

      renderPicker({ allowEmailInvite: true });

      await user.click(screen.getByLabelText("sharing.granteeTypeLabel"));
      await user.click(screen.getByRole("option", { name: "sharing.granteeTypeOrganization" }));
      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "new@uni.edu");

      await waitFor(() =>
        expect(screen.getByText("sharing.noOrganizationsFound")).toBeInTheDocument(),
      );
      expect(screen.queryByText("sharing.sendInviteByEmail")).not.toBeInTheDocument();
    });
  });

  it("shows the current selection and clears it on request", async () => {
    const user = userEvent.setup();
    const selection: GranteeSelection = {
      kind: "grantee",
      grantee: { type: "user", id: "u-1", displayName: "Lin Zhao" },
    };

    const { onSelectionChange } = renderPicker({ selection });

    expect(screen.getByLabelText("sharing.granteeSearchLabel")).toHaveValue("Lin Zhao");

    await user.click(screen.getByRole("button", { name: "sharing.clearSelection" }));
    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it("does not offer one user's organizations to the next user on the same client", async () => {
    const user = userEvent.setup();
    // Organization search returns the caller's *own* memberships, so its cache
    // must not carry across a sign-out → sign-in on a shared QueryClient.
    const queryClient = createTestQueryClient();
    const onSelectionChange = vi.fn();
    const element = () => (
      <GranteePicker
        resourceType="experiment"
        resourceId="exp-1"
        role="viewer"
        selection={null}
        onSelectionChange={onSelectionChange}
      />
    );

    mockSession({ id: "user-a" });
    server.mount(contract.sharing.searchGranteeOrganizations, {
      body: [{ id: "org-a", name: "Greenhouse Lab", slug: "greenhouse-lab" }],
    });

    const { rerender } = render(element(), { queryClient });

    await user.click(screen.getByLabelText("sharing.granteeTypeLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.granteeTypeOrganization" }));
    await user.click(screen.getByLabelText("sharing.granteeSearchLabel"));
    await waitFor(() => expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument());

    mockSession({ id: "user-b" });
    server.mount(contract.sharing.searchGranteeOrganizations, {
      body: [{ id: "org-b", name: "Partner Lab", slug: "partner-lab" }],
    });
    rerender(element());

    // User B never sees A's organization, and once their own query settles they
    // see only theirs.
    expect(screen.queryByText("Greenhouse Lab")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Partner Lab")).toBeInTheDocument());
    expect(screen.queryByText("Greenhouse Lab")).not.toBeInTheDocument();
  });

  it("locks its controls while the host is submitting", () => {
    renderPicker({ disabled: true });

    expect(screen.getByLabelText("sharing.granteeSearchLabel")).toBeDisabled();
    expect(screen.getByLabelText("sharing.granteeTypeLabel")).toBeDisabled();
  });
});
