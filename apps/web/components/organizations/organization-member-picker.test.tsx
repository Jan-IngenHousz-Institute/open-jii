import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import type { OrganizationInviteSelection } from "./organization-member-picker";
import { OrganizationMemberPicker } from "./organization-member-picker";

function renderPicker(
  overrides: Partial<React.ComponentProps<typeof OrganizationMemberPicker>> = {},
) {
  const onSelectionChange = vi.fn();
  const result = render(
    <OrganizationMemberPicker
      selection={null}
      onSelectionChange={onSelectionChange}
      memberUserIds={[]}
      memberEmails={[]}
      pendingInvitationEmails={[]}
      {...overrides}
    />,
  );
  return { ...result, onSelectionChange };
}

const search = () => screen.getByLabelText("organizations.invite.searchLabel");

describe("<OrganizationMemberPicker />", () => {
  it("reports a registered user as a user selection", async () => {
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

    await user.type(search(), "lin");

    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.getByText("lin@uni.edu")).toBeInTheDocument();

    await user.click(screen.getByText("Lin Zhao"));

    // The address rides along with the pick, because a picked account is invited at it
    // rather than added — so the invitation has somewhere to go.
    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: "user",
      userId: "u-1",
      displayName: "Lin Zhao",
      email: "lin@uni.edu",
    });
  });

  it("does not browse users without a search term", async () => {
    const user = userEvent.setup();
    const userSpy = server.mount(contract.users.searchUsers, { body: [] });

    renderPicker();

    await user.click(search());

    expect(screen.queryByText("organizations.invite.noMatches")).not.toBeInTheDocument();
    expect(userSpy.called).toBe(false);
  });

  it("drops an existing member from the results, keeping the rest pickable", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({ userId: "u-1", firstName: "Mel", lastName: "Member" }),
        createUserProfile({ userId: "u-2", firstName: "New", lastName: "Person" }),
      ],
    });

    const { onSelectionChange } = renderPicker({ memberUserIds: ["u-1"] });

    await user.type(search(), "e");

    // Filtered out rather than listed unpickably, matching the sharing picker: a row
    // that cannot be picked is noise in a list whose only purpose is picking.
    await waitFor(() => expect(screen.getByText("New Person")).toBeInTheDocument());
    expect(screen.queryByText("Mel Member")).not.toBeInTheDocument();

    await user.click(screen.getByText("New Person"));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "user", userId: "u-2" }),
    );
  });

  it("drops a registered user who already has a pending invitation", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "Ada",
          lastName: "Waiting",
          email: "ada@uni.edu",
        }),
      ],
    });

    renderPicker({ pendingInvitationEmails: ["Ada@Uni.edu"] });

    await user.type(search(), "ada");

    // Case-insensitively: an address is the same address whatever its casing.
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.noMatches")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Ada Waiting")).not.toBeInTheDocument();
  });

  it("explains a typed address whose owner the results dropped, rather than saying nothing was found", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "Mel",
          lastName: "Member",
          email: "mel@uni.edu",
        }),
      ],
    });

    renderPicker({ memberUserIds: ["u-1"] });

    await user.type(search(), "mel@uni.edu");

    // The exclusion check reads the unfiltered answer, so this address is neither
    // reported as unknown nor offered as an invitation to somebody already inside.
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.alreadyMember")).toBeInTheDocument(),
    );
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
    expect(screen.queryByText("organizations.invite.noMatches")).not.toBeInTheDocument();
  });

  it("uses the caller's own wording for an exclusion when it is given one", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "Mel",
          lastName: "Member",
          email: "mel@uni.edu",
        }),
      ],
    });

    // What the create wizard passes: it collects people for an organization that does
    // not exist, so "already a member" would be false of them.
    renderPicker({ memberUserIds: ["u-1"], excludedLabel: "Already added" });

    await user.type(search(), "mel@uni.edu");

    await waitFor(() => expect(screen.getByText("Already added")).toBeInTheDocument());
    expect(screen.queryByText("organizations.invite.alreadyMember")).not.toBeInTheDocument();
  });

  it("offers an unmatched address as an email invitation", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, { body: [] });

    const { onSelectionChange } = renderPicker();

    await user.type(search(), "stranger@uni.edu");

    await waitFor(() =>
      expect(screen.getByText("organizations.invite.sendByEmail")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("organizations.invite.sendByEmail"));

    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: "email",
      email: "stranger@uni.edu",
    });
  });

  it("offers the account rather than the bare address for a registered one", async () => {
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

    renderPicker();

    await user.type(search(), "lin@uni.edu");

    // Both routes end in an invitation, but the named account is the better one: it
    // carries who was picked, and the roster can show them by name once they accept.
    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
  });

  it("refuses to re-invite an address already invited or already on the roster", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, { body: [] });

    const { rerender } = renderPicker({ pendingInvitationEmails: ["waiting@uni.edu"] });

    await user.type(search(), "waiting@uni.edu");
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.alreadyInvited")).toBeInTheDocument(),
    );
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();

    // A member the user search cannot return — one who never finished onboarding —
    // is still not worth an invitation.
    rerender(
      <OrganizationMemberPicker
        selection={null}
        onSelectionChange={vi.fn()}
        memberUserIds={[]}
        memberEmails={["waiting@uni.edu"]}
        pendingInvitationEmails={[]}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.alreadyMember")).toBeInTheDocument(),
    );
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
  });

  /**
   * A registered account can now be waiting on an invitation too — that is what an
   * elevated pick creates. So the pending state has to win over "this person has an
   * account", or the actor would pick them again and get a duplicate-invite refusal
   * instead of being told there is already one out.
   */
  it("reports a registered account that already has a pending invitation as invited", async () => {
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

    renderPicker({ pendingInvitationEmails: ["lin@uni.edu"] });

    await user.type(search(), "lin@uni.edu");

    await waitFor(() =>
      expect(screen.getByText("organizations.invite.alreadyInvited")).toBeInTheDocument(),
    );
    // Not offered as a pick either, so there is no way to reach the duplicate.
    expect(screen.queryByText("Lin Zhao")).not.toBeInTheDocument();
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
  });

  /**
   * Every pick becomes an invitation, so a result with no address is a pick that could
   * not be acted on. Dropping it here is what lets the selection type promise an
   * address, which is what removes the dead "nowhere to send it" branch from both
   * callers. `users.email` is `NOT NULL` and this endpoint only returns activated
   * accounts, so this is a type boundary rather than a case seen in practice.
   */
  it("drops a result with no address, since an invitation could not reach it", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({ userId: "u-1", firstName: "No", lastName: "Address", email: null }),
        createUserProfile({
          userId: "u-2",
          firstName: "Has",
          lastName: "Address",
          email: "has@uni.edu",
        }),
      ],
    });

    const { onSelectionChange } = renderPicker();

    await user.type(search(), "address");

    await waitFor(() => expect(screen.getByText("Has Address")).toBeInTheDocument());
    expect(screen.queryByText("No Address")).not.toBeInTheDocument();

    await user.click(screen.getByText("Has Address"));
    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: "user",
      userId: "u-2",
      displayName: "Has Address",
      email: "has@uni.edu",
    });
  });

  it("treats a failed search as unknown rather than as an address nobody holds", async () => {
    const user = userEvent.setup();
    const userSpy = server.mount(contract.users.searchUsers, { status: 500 });

    const { onSelectionChange } = renderPicker();

    await user.type(search(), "lin@uni.edu");

    // An account may well answer to this address — the search just could not say so.
    // Offering the bare address would sideline the account it belongs to.
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.searchFailed")).toBeInTheDocument(),
    );
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
    expect(screen.queryByText("organizations.invite.noMatches")).not.toBeInTheDocument();
    expect(onSelectionChange).not.toHaveBeenCalled();

    const attempts = userSpy.callCount;
    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    await waitFor(() => expect(userSpy.callCount).toBeGreaterThan(attempts));
  });

  it("shows the current selection and clears it on request", async () => {
    const user = userEvent.setup();
    const selection: OrganizationInviteSelection = {
      kind: "user",
      userId: "u-1",
      displayName: "Lin Zhao",
      email: "lin@uni.edu",
    };

    const { onSelectionChange } = renderPicker({ selection });

    expect(search()).toHaveValue("Lin Zhao");

    await user.click(screen.getByRole("button", { name: "organizations.invite.clearSelection" }));
    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it("locks its input while the host is submitting", () => {
    renderPicker({ disabled: true });

    expect(search()).toBeDisabled();
  });
});
