import { createUserProfile } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MemberList } from "./current-members-list";

describe("<MemberList />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no members are provided", () => {
    render(
      <MemberList onRemoveMember={vi.fn()} isRemovingMember={false} removingMemberId={null} />,
    );

    expect(screen.getByText("experimentSettings.noMembersYet")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.addCollaborators")).toBeInTheDocument();
  });

  it("renders member from raw members + users props", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <MemberList
        members={[{ userId: "user-2", role: "member" }]}
        users={[
          createUserProfile({
            userId: "user-2",
            firstName: "Grace",
            lastName: "Hopper",
            email: "grace@example.com",
          }),
        ]}
        onRemoveMember={onRemove}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={0}
        newExperiment={true}
      />,
    );

    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.roleMember")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("experimentSettings.remove"));

    expect(onRemove).toHaveBeenCalledWith("user-2");
  });

  it("shows fallback text when member has no email", async () => {
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "admin",
            joinedAt: "2023-01-02T00:00:00.000Z",
            user: createUserProfile({
              userId: "user-3",
              firstName: "Katherine",
              lastName: "Johnson",
              email: null,
            }),
          },
        ]}
        onRemoveMember={vi.fn()}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={1}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="current-user"
      />,
    );

    expect(screen.getByText("Katherine Johnson")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.noEmail")).toBeInTheDocument();
  });

  it("disables remove option for the last admin", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "admin",
            joinedAt: "2023-01-02T00:00:00.000Z",
            user: createUserProfile({ userId: "user-3" }),
          },
        ]}
        onRemoveMember={onRemove}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={1}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="current-user"
      />,
    );

    await user.click(screen.getByRole("combobox"));

    const removeOption = screen.getByText("experimentSettings.remove");
    expect(removeOption.closest('[role="option"]')).toHaveAttribute("data-disabled");
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("only disables remove for the member currently being removed", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "member",
            joinedAt: "2024-01-01T00:00:00.000Z",
            user: createUserProfile({ userId: "u1", firstName: "First" }),
          },
          {
            role: "member",
            joinedAt: "2024-01-02T00:00:00.000Z",
            user: createUserProfile({ userId: "u2", firstName: "Second" }),
          },
        ]}
        onRemoveMember={onRemove}
        isRemovingMember={true}
        removingMemberId="u2"
        adminCount={0}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="current-user"
      />,
    );

    const selectTriggers = screen.getAllByRole("combobox");
    expect(selectTriggers).toHaveLength(2);

    await user.click(selectTriggers[0]);
    await user.click(screen.getAllByText("experimentSettings.remove")[0]);

    expect(onRemove).toHaveBeenCalledWith("u1");
  });

  it("asks for confirmation before current user leaves the experiment", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "member",
            joinedAt: "2024-01-01T00:00:00.000Z",
            user: createUserProfile({ userId: "current-user" }),
          },
        ]}
        onRemoveMember={onRemove}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={0}
        experimentId="exp-1"
        currentUserRole="member"
        currentUserId="current-user"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("experimentSettings.leave"));

    expect(screen.getByText("experimentSettings.confirmLeaveTitle")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "experimentSettings.confirmLeave" }));

    expect(onRemove).toHaveBeenCalledWith("current-user");
  });

  it("warns that the last admin cannot leave", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "admin",
            joinedAt: "2024-01-01T00:00:00.000Z",
            user: createUserProfile({ userId: "admin-user" }),
          },
        ]}
        onRemoveMember={onRemove}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={1}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="admin-user"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("experimentSettings.leave"));

    expect(screen.getByText("experimentSettings.cannotLeaveAsLastAdmin")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.ok" }));

    expect(onRemove).not.toHaveBeenCalled();
  });

  it("asks for confirmation when admin demotes themselves to member", async () => {
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "admin",
            joinedAt: "2024-01-01T00:00:00.000Z",
            user: createUserProfile({ userId: "admin-user" }),
          },
          {
            role: "admin",
            joinedAt: "2024-01-02T00:00:00.000Z",
            user: createUserProfile({ userId: "other-admin" }),
          },
        ]}
        onRemoveMember={vi.fn()}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={2}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="admin-user"
      />,
    );

    const selectTriggers = screen.getAllByRole("combobox");
    await user.click(selectTriggers[0]);

    const dropdownMemberOption = screen
      .getAllByText("experimentSettings.roleMember")
      .find((el) => el.closest('[role="option"]') !== null);
    if (dropdownMemberOption) await user.click(dropdownMemberOption);

    expect(screen.getByText("experimentSettings.confirmDemoteTitle")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.cancel" }));
  });

  it("warns that the last admin cannot demote themselves", async () => {
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "admin",
            joinedAt: "2024-01-01T00:00:00.000Z",
            user: createUserProfile({ userId: "admin-user" }),
          },
        ]}
        onRemoveMember={vi.fn()}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={1}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="admin-user"
      />,
    );

    await user.click(screen.getByRole("combobox"));

    const dropdownMemberOption = screen
      .getAllByText("experimentSettings.roleMember")
      .find((el) => el.closest('[role="option"]') !== null);
    if (dropdownMemberOption) await user.click(dropdownMemberOption);

    expect(screen.getByText("experimentSettings.cannotDemoteAsLastAdmin")).toBeInTheDocument();
  });

  it("promotes another member to admin via onUpdateMemberRole", async () => {
    const onUpdateRole = vi.fn();
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "member",
            joinedAt: "2024-01-01T00:00:00.000Z",
            user: createUserProfile({ userId: "member-user" }),
          },
        ]}
        onRemoveMember={vi.fn()}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={1}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="admin-user"
        newExperiment={true}
        onUpdateMemberRole={onUpdateRole}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("experimentSettings.roleAdmin"));

    expect(onUpdateRole).toHaveBeenCalledWith("member-user", "admin");
  });

  it("removes another member without confirmation dialog", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <MemberList
        membersWithUserInfo={[
          {
            role: "member",
            joinedAt: "2024-01-01T00:00:00.000Z",
            user: createUserProfile({ userId: "member-user" }),
          },
        ]}
        onRemoveMember={onRemove}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={1}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="admin-user"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("experimentSettings.remove"));

    expect(onRemove).toHaveBeenCalledWith("member-user");
  });
});
