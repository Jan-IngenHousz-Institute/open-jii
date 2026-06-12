import { createUserProfile } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { MemberItem } from "./member-item";

const mockUser = createUserProfile({
  userId: "user-123",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
});

const mockMember = {
  role: "member",
  joinedAt: "2024-01-15T10:00:00.000Z",
  user: mockUser,
};

describe("<MemberItem />", () => {
  it("renders member information correctly", () => {
    const onValueChange = vi.fn();

    render(
      <MemberItem
        member={mockMember}
        isLastAdmin={false}
        currentUserId="current-user"
        isCurrentUserAdmin={true}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.roleMember")).toBeInTheDocument();
  });

  it("renders member with no email", () => {
    const memberNoEmail = {
      ...mockMember,
      user: { ...mockUser, email: null },
    };

    render(
      <MemberItem
        member={memberNoEmail}
        isLastAdmin={false}
        currentUserId="current-user"
        isCurrentUserAdmin={true}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("experimentSettings.noEmail")).toBeInTheDocument();
  });

  it("renders admin role correctly", () => {
    const adminMember = {
      ...mockMember,
      role: "admin",
    };

    render(
      <MemberItem
        member={adminMember}
        isLastAdmin={false}
        currentUserId="current-user"
        isCurrentUserAdmin={true}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("experimentSettings.roleAdmin")).toBeInTheDocument();
  });

  it("calls onValueChange when role is changed", async () => {
    const onValueChange = vi.fn();

    render(
      <MemberItem
        member={mockMember}
        isLastAdmin={false}
        currentUserId="current-user"
        isCurrentUserAdmin={true}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={onValueChange}
      />,
    );

    const user = userEvent.setup();
    const selectTrigger = screen.getByRole("combobox");
    await user.click(selectTrigger);

    const adminOption = screen.getByText("experimentSettings.roleAdmin");
    await user.click(adminOption);

    expect(onValueChange).toHaveBeenCalledWith("admin");
  });

  it("shows leave option for current user", async () => {
    const onValueChange = vi.fn();

    render(
      <MemberItem
        member={mockMember}
        isLastAdmin={false}
        currentUserId="user-123"
        isCurrentUserAdmin={false}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={onValueChange}
      />,
    );

    const user = userEvent.setup();
    const selectTrigger = screen.getByRole("combobox");
    await user.click(selectTrigger);

    expect(screen.getByText("experimentSettings.leave")).toBeInTheDocument();
  });

  it("shows remove option for other users", async () => {
    const onValueChange = vi.fn();

    render(
      <MemberItem
        member={mockMember}
        isLastAdmin={false}
        currentUserId="different-user"
        isCurrentUserAdmin={true}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={onValueChange}
      />,
    );

    const user = userEvent.setup();
    const selectTrigger = screen.getByRole("combobox");
    await user.click(selectTrigger);

    expect(screen.getByText("experimentSettings.remove")).toBeInTheDocument();
  });

  it("disables select when user is not admin and not current user", () => {
    render(
      <MemberItem
        member={mockMember}
        isLastAdmin={false}
        currentUserId="different-user"
        isCurrentUserAdmin={false}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={vi.fn()}
      />,
    );

    const selectTrigger = screen.getByRole("combobox");
    expect(selectTrigger).toBeDisabled();
  });

  it("enables select in new experiment mode", () => {
    render(
      <MemberItem
        member={mockMember}
        isLastAdmin={false}
        currentUserId="different-user"
        isCurrentUserAdmin={false}
        updatingMemberId={null}
        experimentId={undefined}
        newExperiment={true}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={vi.fn()}
      />,
    );

    const selectTrigger = screen.getByRole("combobox");
    expect(selectTrigger).not.toBeDisabled();
  });

  it("disables remove option when member is being removed", async () => {
    render(
      <MemberItem
        member={mockMember}
        isLastAdmin={false}
        currentUserId="different-user"
        isCurrentUserAdmin={true}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={true}
        removingMemberId="user-123"
        onValueChange={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    const selectTrigger = screen.getByRole("combobox");
    await user.click(selectTrigger);

    const removeOption = screen.getByText("experimentSettings.remove");
    expect(removeOption.closest('[role="option"]')).toHaveAttribute("data-disabled");
  });

  it("disables role options when last admin", async () => {
    const adminMember = {
      ...mockMember,
      role: "admin",
    };

    render(
      <MemberItem
        member={adminMember}
        isLastAdmin={true}
        currentUserId="different-user"
        isCurrentUserAdmin={true}
        updatingMemberId={null}
        experimentId="exp-1"
        newExperiment={false}
        isRemovingMember={false}
        removingMemberId={null}
        onValueChange={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    const selectTrigger = screen.getByRole("combobox");
    await user.click(selectTrigger);

    // Find the member option in the dropdown
    const memberOptions = screen.getAllByText("experimentSettings.roleMember");
    const dropdownOption = memberOptions.find((el) => el.closest('[role="option"]') !== null);
    expect(dropdownOption?.closest('[role="option"]')).toHaveAttribute("data-disabled");
  });
});
