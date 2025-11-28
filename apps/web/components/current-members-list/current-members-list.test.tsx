import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { UserProfile } from "@repo/api";

import { MemberList } from "./current-members-list";

globalThis.React = React;

/* ----------------------------- Types ----------------------------- */

type StrictUserProfile = UserProfile & {
  userId: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  bio: string | null;
  organization?: string | undefined;
};

interface StrictMember {
  userId: string;
  role?: "admin" | "member";
}

/* ------------------------------------ Mocks ------------------------------------ */

// Mock useExperimentMemberRoleUpdate to avoid ts-rest dependency
vi.mock(
  "../../hooks/experiment/useExperimentMemberRoleUpdate/useExperimentMemberRoleUpdate",
  () => ({
    useExperimentMemberRoleUpdate: () => ({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      isPending: false,
    }),
  }),
);

// i18n – returns the key (intentionally dumb)
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock useLocale hook
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

/* --------------------------------- Test data ---------------------------------- */

const mkUser = (over: Partial<StrictUserProfile> = {}): StrictUserProfile => {
  const userId = over.userId ?? "user-1";
  return {
    userId,
    id: over.id ?? userId,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    bio: null,
    organization: undefined,
    activated: null,
    ...over,
  };
};

const mkMember = (over: Partial<StrictMember> = {}): StrictMember => ({
  userId: over.userId ?? "user-1",
  role: over.role,
});

/* --------------------------------- Helpers ---------------------------------- */

const renderWithProvider = (ui: React.ReactElement) => {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

/* ----------------------------------- Tests ------------------------------------ */

describe("<MemberList />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no membersWithUserInfo and no members", () => {
    renderWithProvider(
      <MemberList
        onRemoveMember={() => {
          /* No op */
        }}
        isRemovingMember={false}
        removingMemberId={null}
      />,
    );

    expect(screen.getByText("experimentSettings.noMembersYet")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.addCollaborators")).toBeInTheDocument();
  });

  it("converts members + users to membersWithUserInfo and calls onRemoveMember", () => {
    const onRemove = vi.fn();
    const user: StrictUserProfile = mkUser({
      userId: "user-2",
      id: "user-2",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
    });
    const member: StrictMember = mkMember({ userId: "user-2", role: "member" });

    renderWithProvider(
      <MemberList
        members={[member]}
        users={[user]}
        onRemoveMember={onRemove}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={0}
        newExperiment={true}
      />,
    );

    // Name + email present
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.roleMember")).toBeInTheDocument();

    const selectTrigger = screen.getByRole("combobox");
    expect(selectTrigger).toBeInTheDocument();
    fireEvent.click(selectTrigger);

    // Find and click the remove option in the dropdown
    const removeOption = screen.getByText("experimentSettings.remove");
    fireEvent.click(removeOption);
    expect(onRemove).toHaveBeenCalledWith("user-2");
  });

  it("uses provided membersWithUserInfo as-is, shows key for no email, and disables last admin removal", () => {
    const onRemove = vi.fn();

    renderWithProvider(
      <MemberList
        membersWithUserInfo={[
          {
            role: "admin",
            joinedAt: "2023-01-02T00:00:00.000Z",
            user: mkUser({
              userId: "user-3",
              id: "user-3",
              firstName: "Katherine",
              lastName: "Johnson",
              email: null,
            }),
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

    expect(screen.getByText("Katherine Johnson")).toBeInTheDocument();

    // No email -> i18n key
    expect(screen.getByText("experimentSettings.noEmail")).toBeInTheDocument();

    expect(screen.getByText("experimentSettings.roleAdmin")).toBeInTheDocument();

    // Check that the Select component is present
    const selectTrigger = screen.getByRole("combobox");
    expect(selectTrigger).toBeInTheDocument();
    fireEvent.click(selectTrigger);

    // The remove option should be disabled for the last admin
    const removeOption = screen.getByText("experimentSettings.remove");
    expect(removeOption.closest('[role="option"]')).toHaveAttribute("data-disabled");

    // Ensure remove was not called
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("disables the remove button only for the member currently being removed", () => {
    const onRemove = vi.fn();
    const u1 = mkUser({ userId: "u1", id: "u1", firstName: "First", lastName: "User" });
    const u2 = mkUser({ userId: "u2", id: "u2", firstName: "Second", lastName: "User" });

    renderWithProvider(
      <MemberList
        membersWithUserInfo={[
          { role: "member", joinedAt: "2024-01-01T00:00:00.000Z", user: u1 },
          { role: "member", joinedAt: "2024-01-02T00:00:00.000Z", user: u2 },
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

    // There are 2 combobox elements (Select components), one for each member
    const selectTriggers = screen.getAllByRole("combobox");
    expect(selectTriggers).toHaveLength(2);

    // Open the first member's dropdown and click remove
    fireEvent.click(selectTriggers[0]);
    const removeOptions = screen.getAllByText("experimentSettings.remove");

    // First member's remove option should not be disabled
    fireEvent.click(removeOptions[0]);
    expect(onRemove).toHaveBeenCalledWith("u1");
  });

  it("shows leave confirmation dialog when current user tries to leave", () => {
    const onRemove = vi.fn();
    const currentUser = mkUser({
      userId: "current-user",
      id: "current-user",
      firstName: "Current",
      lastName: "User",
    });

    renderWithProvider(
      <MemberList
        membersWithUserInfo={[
          { role: "member", joinedAt: "2024-01-01T00:00:00.000Z", user: currentUser },
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

    // Open dropdown and select leave
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    const leaveOption = screen.getByText("experimentSettings.leave");
    fireEvent.click(leaveOption);

    // Should show leave confirmation dialog
    expect(screen.getByText("experimentSettings.confirmLeaveTitle")).toBeInTheDocument();

    // Confirm leave
    const confirmButton = screen.getByRole("button", { name: "experimentSettings.confirmLeave" });
    fireEvent.click(confirmButton);

    expect(onRemove).toHaveBeenCalledWith("current-user");
  });

  it("shows last admin warning when last admin tries to leave", () => {
    const onRemove = vi.fn();
    const adminUser = mkUser({
      userId: "admin-user",
      id: "admin-user",
      firstName: "Admin",
      lastName: "User",
    });

    renderWithProvider(
      <MemberList
        membersWithUserInfo={[
          { role: "admin", joinedAt: "2024-01-01T00:00:00.000Z", user: adminUser },
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

    // Open dropdown and select leave
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    const leaveOption = screen.getByText("experimentSettings.leave");
    fireEvent.click(leaveOption);

    // Should show last admin warning dialog
    expect(screen.getByText("experimentSettings.cannotLeaveAsLastAdmin")).toBeInTheDocument();

    // Close dialog
    const closeButton = screen.getByRole("button", { name: "common.ok" });
    fireEvent.click(closeButton);

    expect(onRemove).not.toHaveBeenCalled();
  });

  it("shows demote confirmation dialog when admin demotes themselves", () => {
    const onRemove = vi.fn();
    const adminUser = mkUser({
      userId: "admin-user",
      id: "admin-user",
      firstName: "Admin",
      lastName: "User",
    });
    const otherAdmin = mkUser({
      userId: "other-admin",
      id: "other-admin",
      firstName: "Other",
      lastName: "Admin",
    });

    renderWithProvider(
      <MemberList
        membersWithUserInfo={[
          { role: "admin", joinedAt: "2024-01-01T00:00:00.000Z", user: adminUser },
          { role: "admin", joinedAt: "2024-01-02T00:00:00.000Z", user: otherAdmin },
        ]}
        onRemoveMember={onRemove}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={2}
        experimentId="exp-1"
        currentUserRole="admin"
        currentUserId="admin-user"
      />,
    );

    // Open dropdown for current admin user
    const selectTriggers = screen.getAllByRole("combobox");
    fireEvent.click(selectTriggers[0]);

    // Select member role (demote) - need to find it in the portal/dropdown content
    const memberOptions = screen.getAllByText("experimentSettings.roleMember");
    // Click the one that's inside the dropdown (not the trigger)
    const dropdownMemberOption = memberOptions.find((el) => el.closest('[role="option"]') !== null);
    if (dropdownMemberOption) {
      fireEvent.click(dropdownMemberOption);
    }

    // Should show demote confirmation dialog
    expect(screen.getByText("experimentSettings.confirmDemoteTitle")).toBeInTheDocument();

    // Cancel demotion
    const cancelButton = screen.getByRole("button", { name: "common.cancel" });
    fireEvent.click(cancelButton);
  });

  it("shows last admin warning when last admin tries to demote themselves", () => {
    const onRemove = vi.fn();
    const adminUser = mkUser({
      userId: "admin-user",
      id: "admin-user",
      firstName: "Admin",
      lastName: "User",
    });

    renderWithProvider(
      <MemberList
        membersWithUserInfo={[
          { role: "admin", joinedAt: "2024-01-01T00:00:00.000Z", user: adminUser },
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

    // Open dropdown
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    // Try to select member role (demote)
    const memberOptions = screen.getAllByText("experimentSettings.roleMember");
    const dropdownMemberOption = memberOptions.find((el) => el.closest('[role="option"]') !== null);
    if (dropdownMemberOption) {
      fireEvent.click(dropdownMemberOption);
    }

    // Should show last admin warning
    expect(screen.getByText("experimentSettings.cannotDemoteAsLastAdmin")).toBeInTheDocument();
  });

  it("allows admin to change another member's role from member to admin", () => {
    const onRemove = vi.fn();
    const onUpdateRole = vi.fn();
    const memberUser = mkUser({
      userId: "member-user",
      id: "member-user",
      firstName: "Member",
      lastName: "User",
    });

    renderWithProvider(
      <MemberList
        membersWithUserInfo={[
          { role: "member", joinedAt: "2024-01-01T00:00:00.000Z", user: memberUser },
        ]}
        onRemoveMember={onRemove}
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

    // Open dropdown
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    // Select admin role
    const adminOption = screen.getByText("experimentSettings.roleAdmin");
    fireEvent.click(adminOption);

    // Should call onUpdateMemberRole for new experiment
    expect(onUpdateRole).toHaveBeenCalledWith("member-user", "admin");
  });

  it("allows admin to remove another member directly", () => {
    const onRemove = vi.fn();
    const memberUser = mkUser({
      userId: "member-user",
      id: "member-user",
      firstName: "Member",
      lastName: "User",
    });

    renderWithProvider(
      <MemberList
        membersWithUserInfo={[
          { role: "member", joinedAt: "2024-01-01T00:00:00.000Z", user: memberUser },
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

    // Open dropdown
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    // Click remove
    const removeOption = screen.getByText("experimentSettings.remove");
    fireEvent.click(removeOption);

    // Should call onRemoveMember directly without confirmation
    expect(onRemove).toHaveBeenCalledWith("member-user");
  });
});
