import { createUserProfile } from "@/test/factories";
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
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
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

  it("does not offer users who already hold a grant", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({ userId: "u-1", firstName: "Already", lastName: "Shared" }),
        createUserProfile({ userId: "u-2", firstName: "Not", lastName: "Shared" }),
      ],
    });

    renderPicker({ existingGranteeIds: ["u-1"] });

    await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "shared");

    await waitFor(() => expect(screen.getByText("Not Shared")).toBeInTheDocument());
    expect(screen.queryByText("Already Shared")).not.toBeInTheDocument();
  });

  it("does not browse users without a search term", async () => {
    const user = userEvent.setup();
    const userSpy = server.mount(contract.users.searchUsers, { body: [] });

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
      server.mount(contract.users.searchUsers, { body: [] });

      const { onSelectionChange } = renderPicker();

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "new@uni.edu");

      // A macro or workbook has nowhere to park a pending invitation.
      await waitFor(() => expect(screen.getByText("sharing.noUsersFound")).toBeInTheDocument());
      expect(screen.queryByText("sharing.sendInviteByEmail")).not.toBeInTheDocument();
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("reports a typed address as an email selection", async () => {
      const user = userEvent.setup();
      server.mount(contract.users.searchUsers, { body: [] });

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
      server.mount(contract.users.searchUsers, { body: [] });

      renderPicker({ allowEmailInvite: true, existingEmails: ["Pending@Uni.edu"] });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "pending@uni.edu");

      await waitFor(() =>
        expect(screen.getByText("sharing.emailAlreadyInvited")).toBeInTheDocument(),
      );
      expect(screen.queryByText("sharing.sendInviteByEmail")).not.toBeInTheDocument();
    });

    it("offers the account, not an invitation, for a registered address", async () => {
      const user = userEvent.setup();
      server.mount(contract.users.searchUsers, {
        body: [
          createUserProfile({
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

    it("says an existing collaborator already has access instead of offering to invite them", async () => {
      const user = userEvent.setup();
      server.mount(contract.users.searchUsers, {
        body: [
          createUserProfile({
            userId: "u-1",
            firstName: "Lin",
            lastName: "Zhao",
            email: "lin@uni.edu",
          }),
        ],
      });

      // Lin already holds a grant, so they are filtered out of the rows. Without
      // checking the unfiltered results, an email invite would be the only thing
      // left on screen for an address that needs no invitation at all.
      renderPicker({ allowEmailInvite: true, existingGranteeIds: ["u-1"] });

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "lin@uni.edu");

      await waitFor(() =>
        expect(screen.getByText("sharing.emailAlreadyCollaborator")).toBeInTheDocument(),
      );
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
