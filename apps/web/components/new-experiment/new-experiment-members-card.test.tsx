import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateExperimentBody, UserProfile } from "@repo/api";

import { NewExperimentMembersCard } from "./new-experiment-members-card";

globalThis.React = React;

/* ---------------------------------- Mocks ---------------------------------- */

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "current-user-id" } },
  }),
}));

const useDebounceMock = vi.fn();
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (val: string) => useDebounceMock(val) as [string, boolean],
}));

const useUserSearchMock = vi.fn();
vi.mock("@/hooks/useUserSearch", () => ({
  useUserSearch: () => useUserSearchMock() as { data: { body: UserProfile[] }; isLoading: boolean },
}));

vi.mock("@/hooks/experiment/useExperimentMemberRoleUpdate/useExperimentMemberRoleUpdate", () => ({
  useExperimentMemberRoleUpdate: () => ({
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../current-members-list/current-members-list", () => ({
  MemberList: ({
    members,
    onRemoveMember,
    adminCount,
  }: {
    members?: { userId: string; firstName?: string; user?: { firstName?: string } }[];
    onRemoveMember: (userId: string) => void;
    adminCount?: number;
  }) => (
    <div data-testid="member-list">
      {members?.map((m) => (
        <div key={m.userId} data-testid={`member-${m.userId}`}>
          <span>{m.firstName ?? m.user?.firstName}</span>
          <button
            aria-label={`remove member ${m.firstName ?? m.user?.firstName}`}
            onClick={() => onRemoveMember(m.userId)}
          >
            Remove
          </button>
        </div>
      ))}
      {adminCount !== undefined && <span data-testid="admin-count">{adminCount} admin(s)</span>}
    </div>
  ),
}));

/* ---------------------------------- Helpers ---------------------------------- */

const mkProfile = (id: string, name: string): UserProfile => ({
  userId: id,
  firstName: name,
  lastName: "Tester",
  email: `${name.toLowerCase()}@mail.com`,
  bio: null,
  activated: null,
  organization: undefined,
});

// Use the actual schema type instead of custom interface
type FormMember = NonNullable<CreateExperimentBody["members"]>[number];

function renderWithForm(initialMembers: FormMember[] = []) {
  function Host() {
    const methods = useForm<CreateExperimentBody>({
      defaultValues: {
        name: "Test Experiment",
        visibility: "private",
        embargoUntil: "",
        status: "active",
        description: "",
        members: initialMembers,
      },
    });
    return <NewExperimentMembersCard form={methods} />;
  }

  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <Host />
    </QueryClientProvider>,
  );
}

const users = [
  mkProfile("current-user-id", "Me"), // should be filtered out
  mkProfile("user-1", "Alice"),
  mkProfile("user-2", "Bob"),
];

/* ---------------------------------- Setup ---------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();

  useDebounceMock.mockImplementation((v: string) => [v, true]);
  useUserSearchMock.mockImplementation(() => ({
    data: { body: users },
    isLoading: false,
  }));
});

/* ---------------------------------- Tests ---------------------------------- */

describe("<NewExperimentMembersCard />", () => {
  it("renders title and description", () => {
    renderWithForm([]);

    expect(screen.getByText("newExperiment.addMembersTitle")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.addMembersDescription")).toBeInTheDocument();
  });

  it("adds a member after selecting from popover and clicking Add", async () => {
    renderWithForm([]);

    // Type in search to trigger user search
    const searchInput = screen.getByPlaceholderText("newExperiment.addMemberPlaceholder");
    fireEvent.change(searchInput, { target: { value: "Alice" } });

    // Wait for and select user from results
    await waitFor(() => {
      expect(screen.getByText("Alice Tester")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Alice Tester"));

    // Click Add button
    await waitFor(() => {
      const addBtn = screen.getByRole("button", { name: "Add" });
      expect(addBtn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // Verify member was added to the list
    await waitFor(() => {
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
    });
  });

  it("removes a member when remove button is clicked", async () => {
    renderWithForm([{ userId: "user-1", role: "member", firstName: "Alice" }]);

    // Member should be visible initially
    expect(screen.getByText(/Alice/)).toBeInTheDocument();

    // Click remove button
    const removeButton = screen.getByLabelText(/remove.*alice/i);
    fireEvent.click(removeButton);

    // Member should be removed
    await waitFor(() => {
      expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
    });
  });

  it("computes adminCount correctly", () => {
    renderWithForm([
      { userId: "u1", role: "admin", firstName: "Admin1" },
      { userId: "u2", role: "admin", firstName: "Admin2" },
      { userId: "u3", role: "member", firstName: "Member1" },
    ]);

    // Verify the admin count is displayed correctly
    const adminCount = screen.getByTestId("admin-count");
    expect(adminCount).toHaveTextContent("2");
  });
});
