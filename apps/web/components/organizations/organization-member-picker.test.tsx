import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import type {
  OrganizationInviteContext,
  OrganizationInviteSelection,
} from "./organization-member-picker";
import {
  describeOrganizationInviteCandidate,
  OrganizationMemberPicker,
} from "./organization-member-picker";

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
  afterEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

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
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "user",
        userId: "u-1",
        displayName: "Lin Zhao",
        email: "lin@uni.edu",
      }),
    );
  });

  it("invites the hidden exact match using only the typed address", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        {
          ...createUserProfile({ userId: "u-1", firstName: "Lin", lastName: "Zhao", email: null }),
          matchedEmail: true,
        },
      ],
    });
    const { onSelectionChange } = renderPicker();
    await user.type(search(), "LIN@uni.edu");
    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.getByText("Lin Zhao").closest("button")).toBeEnabled();
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
    expect(screen.queryByText("organizations.invite.enterExactEmail")).not.toBeInTheDocument();
    expect(screen.getByText("common.emailMatched")).toBeInTheDocument();
    expect(screen.queryByText("LIN@uni.edu")).not.toBeInTheDocument();
    await user.click(screen.getByText("Lin Zhao"));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "user",
        userId: "u-1",
        displayName: "Lin Zhao",
        email: "LIN@uni.edu",
      }),
    );
  });

  it("does not reuse exact-match evidence after the typed address changes", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "Lin",
          lastName: "Zhao",
          email: null,
          matchedEmail: true,
        }),
      ],
    });
    const { onSelectionChange } = renderPicker();
    await user.type(search(), "lin@uni.edu");
    await waitFor(() => expect(screen.getByText("Lin Zhao").closest("button")).toBeEnabled());
    await user.type(search(), "x");
    expect(screen.queryByText("Lin Zhao")).not.toBeInTheDocument();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("prompts for two characters without claiming no matches", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.users.searchUsers, { body: [] });
    renderPicker();
    await user.type(search(), "L");
    await waitFor(() => expect(screen.getByText("common.searchMinCharacters")).toBeInTheDocument());
    expect(screen.queryByText("organizations.invite.noMatches")).not.toBeInTheDocument();
    expect(spy.called).toBe(false);
  });

  it("does not browse users without a search term", async () => {
    const user = userEvent.setup();
    const userSpy = server.mount(contract.users.searchUsers, { body: [] });

    renderPicker();

    await user.click(search());

    expect(screen.queryByText("organizations.invite.noMatches")).not.toBeInTheDocument();
    expect(userSpy.called).toBe(false);
  });

  it("never offers the person inviting", async () => {
    const user = userEvent.setup();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u-me" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({ userId: "u-me", firstName: "Ada", lastName: "Byron" }),
        createUserProfile({ userId: "u-2", firstName: "Ada", lastName: "Sun" }),
      ],
    });

    renderPicker();
    await user.type(search(), "ada");

    await waitFor(() => expect(screen.getByText("Ada Sun")).toBeInTheDocument());
    expect(screen.queryByText("Ada Byron")).not.toBeInTheDocument();
  });

  it("greys out an existing member with the reason, keeping the rest pickable", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({ userId: "u-1", firstName: "Mel", lastName: "Member" }),
        createUserProfile({ userId: "u-2", firstName: "New", lastName: "Person" }),
      ],
    });

    const { onSelectionChange } = renderPicker({ memberUserIds: ["u-1"] });

    await user.type(search(), "ne");

    // Listed where the search put them: a member missing from a search for their name
    // reads as a broken search.
    await waitFor(() => expect(screen.getByText("New Person")).toBeInTheDocument());
    expect(screen.getByText("Mel Member").closest("button")).toBeDisabled();
    expect(screen.getByText("organizations.invite.alreadyMember")).toBeInTheDocument();

    await user.click(screen.getByText("Mel Member"));
    expect(onSelectionChange).not.toHaveBeenCalled();
    await user.click(screen.getByText("New Person"));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "user", userId: "u-2" }),
    );
  });

  it("greys out a registered user who already has a pending invitation", async () => {
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
    await waitFor(() => expect(screen.getByText("Ada Waiting")).toBeInTheDocument());
    expect(screen.getByText("Ada Waiting").closest("button")).toBeDisabled();
    expect(screen.getByText("organizations.invite.alreadyInvited")).toBeInTheDocument();
  });

  it("explains a typed address that belongs to a member, rather than saying nothing was found", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "Mel",
          lastName: "Member",
          email: "mel@uni.edu",
          matchedEmail: true,
        }),
      ],
    });

    renderPicker({ memberUserIds: ["u-1"] });

    await user.type(search(), "mel@uni.edu");

    // Neither reported as unknown nor offered as an invitation to somebody already inside.
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.alreadyMember")).toBeInTheDocument(),
    );
    expect(screen.getByText("Mel Member").closest("button")).toBeDisabled();
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
          matchedEmail: true,
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
          matchedEmail: true,
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
    // Not pickable either, so there is no way to reach the duplicate.
    expect(screen.getByText("Lin Zhao").closest("button")).toBeDisabled();
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
  });

  it("blocks a pending invitation even when search redacts the registered address", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "Lin",
          lastName: "Zhao",
          email: null,
        }),
      ],
    });

    const { onSelectionChange } = renderPicker({
      pendingInvitationEmails: ["lin@uni.edu"],
    });
    await user.type(search(), "lin@uni.edu");

    await waitFor(() =>
      expect(screen.getByText("organizations.invite.alreadyInvited")).toBeInTheDocument(),
    );
    expect(screen.queryByText("organizations.invite.sendByEmail")).not.toBeInTheDocument();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("keeps the email invitation option for a name-only match to an address-like query", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "lin@uni.edu",
          lastName: "Candidate",
          email: null,
        }),
      ],
    });

    const { onSelectionChange } = renderPicker();
    await user.type(search(), "lin@uni.edu");

    await waitFor(() =>
      expect(screen.getByText("organizations.invite.sendByEmail")).toBeInTheDocument(),
    );
    expect(screen.getByText("lin@uni.edu Candidate").closest("button")).toBeDisabled();
    await user.click(screen.getByText("organizations.invite.sendByEmail"));
    expect(onSelectionChange).toHaveBeenCalledWith({ kind: "email", email: "lin@uni.edu" });
  });

  it("keeps a redacted account visible but requires an exact address to invite it", async () => {
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
    expect(screen.getByText("No Address")).toBeInTheDocument();
    expect(screen.getByText("organizations.invite.enterExactEmail")).toBeInTheDocument();
    expect(screen.getByText("No Address").closest("button")).toBeDisabled();

    await user.click(screen.getByText("Has Address"));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "user",
        userId: "u-2",
        displayName: "Has Address",
        email: "has@uni.edu",
      }),
    );
  });

  it("treats a failed search as unknown rather than as an address nobody holds", async () => {
    const user = userEvent.setup();
    const userSpy = server.mount(contract.users.searchUsers, { status: 500 });

    const { onSelectionChange } = renderPicker();

    await user.type(search(), "lin@uni.edu");

    // An account may well answer to this address — the search just could not say so.
    // Offering the bare address would sideline the account it belongs to.
    await waitFor(() => expect(screen.getByText("common.searchFailed")).toBeInTheDocument());
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
      person: { id: "u-1", displayName: "Lin Zhao" },
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

describe("describeOrganizationInviteCandidate", () => {
  const t = (key: string) => key;
  function context(overrides: Partial<OrganizationInviteContext> = {}): OrganizationInviteContext {
    return {
      memberUserIds: [],
      memberEmails: [],
      pendingInvitationEmails: [],
      typedEmail: null,
      t,
      ...overrides,
    };
  }

  it("leaves somebody with a visible address pickable, invited at that address", () => {
    const row = describeOrganizationInviteCandidate(
      createUserProfile({ userId: "u-1", firstName: "Lin", lastName: "Zhao", email: "l@uni.edu" }),
      context(),
    );

    expect(row.unavailableReason).toBeNull();
    expect(row.value).toMatchObject({
      userId: "u-1",
      displayName: "Lin Zhao",
      person: { id: "u-1", firstName: "Lin", lastName: "Zhao" },
      email: "l@uni.edu",
    });
  });

  it("greys out a member", () => {
    const row = describeOrganizationInviteCandidate(
      createUserProfile({ userId: "u-1" }),
      context({ memberUserIds: ["u-1"] }),
    );

    expect(row.unavailableReason).toBe("organizations.invite.alreadyMember");
  });

  it("greys out a pending invitee, ignoring case", () => {
    const row = describeOrganizationInviteCandidate(
      createUserProfile({ email: "lin@uni.edu" }),
      context({ pendingInvitationEmails: ["LIN@uni.edu"] }),
    );

    expect(row.unavailableReason).toBe("organizations.invite.alreadyInvited");
  });

  it("greys out a hidden address until it is typed in full", () => {
    const hidden = createUserProfile({ email: null, matchedEmail: false });
    const matched = createUserProfile({ email: null, matchedEmail: true });

    expect(describeOrganizationInviteCandidate(hidden, context()).unavailableReason).toBe(
      "organizations.invite.enterExactEmail",
    );
    const row = describeOrganizationInviteCandidate(
      matched,
      context({ typedEmail: "Lin@uni.edu" }),
    );
    expect(row.unavailableReason).toBeNull();
    expect(row.identityLine).toBe("common.emailMatched");
    expect(row.value.email).toBe("Lin@uni.edu");
  });

  it("greys out a pending invitee reached through the typed address", () => {
    const row = describeOrganizationInviteCandidate(
      createUserProfile({ email: null, matchedEmail: true }),
      context({ typedEmail: "lin@uni.edu", pendingInvitationEmails: ["lin@uni.edu"] }),
    );

    expect(row.unavailableReason).toBe("organizations.invite.alreadyInvited");
  });

  it("gives somebody already collected the wizard's own reason", () => {
    const collected = context({
      memberUserIds: ["u-1"],
      pendingInvitationEmails: ["ada@uni.edu"],
      excludedLabel: "organizations.create.people.alreadyAdded",
    });

    expect(
      describeOrganizationInviteCandidate(createUserProfile({ userId: "u-1" }), collected)
        .unavailableReason,
    ).toBe("organizations.create.people.alreadyAdded");
    expect(
      describeOrganizationInviteCandidate(
        createUserProfile({ userId: "u-2", email: "ada@uni.edu" }),
        collected,
      ).unavailableReason,
    ).toBe("organizations.create.people.alreadyAdded");
  });
});
