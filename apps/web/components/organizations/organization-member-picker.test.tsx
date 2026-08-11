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

    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: "user",
      userId: "u-1",
      displayName: "Lin Zhao",
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

  it("lists an existing member with the reason, but refuses to pick them", async () => {
    const user = userEvent.setup();
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({ userId: "u-1", firstName: "Mel", lastName: "Member" }),
        createUserProfile({ userId: "u-2", firstName: "New", lastName: "Person" }),
      ],
    });

    const { onSelectionChange } = renderPicker({ memberUserIds: ["u-1"] });

    await user.type(search(), "e");

    // Still listed — dropping them makes the search look broken to somebody who
    // can see them on the roster one tab away.
    await waitFor(() => expect(screen.getByText("Mel Member")).toBeInTheDocument());
    expect(screen.getByText("organizations.invite.alreadyMember")).toBeInTheDocument();

    await user.click(screen.getByText("Mel Member"));
    expect(onSelectionChange).not.toHaveBeenCalled();

    await user.click(screen.getByText("New Person"));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "user", userId: "u-2" }),
    );
  });

  it("marks a registered user who already has a pending invitation", async () => {
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

    const { onSelectionChange } = renderPicker({ pendingInvitationEmails: ["Ada@Uni.edu"] });

    await user.type(search(), "ada");

    // Case-insensitively: an address is the same address whatever its casing.
    await waitFor(() =>
      expect(screen.getByText("organizations.invite.alreadyInvited")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Ada Waiting"));
    expect(onSelectionChange).not.toHaveBeenCalled();
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

  it("offers the account rather than an invitation for a registered address", async () => {
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

    // An invitation to an existing account would sit pending for no reason: that
    // account can be admitted right now.
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

  it("shows the current selection and clears it on request", async () => {
    const user = userEvent.setup();
    const selection: OrganizationInviteSelection = {
      kind: "user",
      userId: "u-1",
      displayName: "Lin Zhao",
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
