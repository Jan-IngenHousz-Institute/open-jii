import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { UserProfile } from "@repo/api";

import { MemberList } from "../current-members-list";

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

// i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: string) =>
      (
        ({
          "experimentSettings.noMembersYet": "No members yet",
          "experimentSettings.addCollaborators": "Add collaborators to get started.",
          "experimentSettings.noEmail": "No email",
          "experimentSettings.joined": "Joined",
          "experimentSettings.cannotRemoveLastAdmin": "Cannot remove the last admin",
          "experimentSettings.removeMember": "Remove member",
          "experimentSettings.defaultRole": fallback ?? "member",
        }) as Record<string, string>
      )[k] ?? k,
  }),
}));

// formatDate
vi.mock("@/util/date", () => ({
  formatDate: (iso: string) => `FMT(${iso.slice(0, 10)})`,
}));

// lucide-react icons
vi.mock("lucide-react", () => {
  const Icon = () => <span data-testid="icon" />;
  return { Trash2: Icon, Mail: Icon, Calendar: Icon };
});

// Minimal Button & Badge
vi.mock("@repo/ui/components", () => {
  const Button = ({
    children,
    onClick,
    disabled,
    title,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={className}>
      {children}
    </button>
  );

  const Badge = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  );

  return { Button, Badge };
});

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
    ...over,
  };
};

const mkMember = (over: Partial<StrictMember> = {}): StrictMember => ({
  userId: over.userId ?? "user-1",
  role: over.role,
});

/* ----------------------------------- Tests ------------------------------------ */

describe("<MemberList />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no membersWithUserInfo and no members", () => {
    render(
      <MemberList
        onRemoveMember={() => {
          /* No op */
        }}
        isRemovingMember={false}
        removingMemberId={null}
      />,
    );

    expect(screen.getByText("No members yet")).toBeInTheDocument();
    expect(screen.getByText("Add collaborators to get started.")).toBeInTheDocument();
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
    const member: StrictMember = mkMember({ userId: "user-2" });

    render(
      <MemberList
        members={[member]}
        users={[user]}
        onRemoveMember={onRemove}
        isRemovingMember={false}
        removingMemberId={null}
        adminCount={0}
      />,
    );

    // Name + email present
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();

    // Role badge shows default "member"
    expect(screen.getByTestId("badge")).toHaveTextContent("member");

    // 'Joined' label present
    expect(screen.getByText(/Joined/)).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", { name: "Remove member" });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("user-2");
  });

  it("uses provided membersWithUserInfo as-is, shows 'No email' when email is null, and disables last admin removal", () => {
    const onRemove = vi.fn();

    render(
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
      />,
    );

    expect(screen.getByText("Katherine Johnson")).toBeInTheDocument();
    expect(screen.getByText("No email")).toBeInTheDocument();
    expect(screen.getByText("Joined FMT(2023-01-02)")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveTextContent("admin");

    const btn = screen.getByRole("button", { name: "Cannot remove the last admin" });
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("disables the remove button only for the member currently being removed", () => {
    const onRemove = vi.fn();
    const u1 = mkUser({ userId: "u1", id: "u1", firstName: "First", lastName: "User" });
    const u2 = mkUser({ userId: "u2", id: "u2", firstName: "Second", lastName: "User" });

    render(
      <MemberList
        membersWithUserInfo={[
          { role: "member", joinedAt: "2024-01-01T00:00:00.000Z", user: u1 },
          { role: "member", joinedAt: "2024-01-02T00:00:00.000Z", user: u2 },
        ]}
        onRemoveMember={onRemove}
        isRemovingMember={true}
        removingMemberId="u2"
        adminCount={0}
      />,
    );

    // Two remove buttons in order of the provided array
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    const firstBtn = buttons[0];
    const secondBtn = buttons[1];

    expect(firstBtn).not.toBeDisabled();
    expect(secondBtn).toBeDisabled();

    fireEvent.click(firstBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("u1");
  });
});
