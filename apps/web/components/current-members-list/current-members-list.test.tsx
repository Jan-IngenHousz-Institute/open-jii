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

// formatDate
vi.mock("@/util/date", () => ({
  formatDate: (iso: string) => `FMT(${iso.slice(0, 10)})`,
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
    expect(screen.getByText(/experimentSettings\.joined/)).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", { name: "experimentSettings.removeMember" });
    fireEvent.click(removeBtn);
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

    // Joined label (key) and formatted date both present (could be split by nodes)
    expect(screen.getByText(/experimentSettings\.joined/)).toBeInTheDocument();
    expect(screen.getByText(/FMT\(2023-01-02\)/, { exact: false })).toBeInTheDocument();

    expect(screen.getByText("experimentSettings.roleAdmin")).toBeInTheDocument();

    const btn = screen.getByRole("button", { name: "experimentSettings.cannotRemoveLastAdmin" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
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

    const buttons = screen.getAllByRole("button", { name: "experimentSettings.removeMember" });
    expect(buttons).toHaveLength(2);

    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).toBeDisabled();

    fireEvent.click(buttons[0]);
    expect(onRemove).toHaveBeenCalledWith("u1");
  });
});
