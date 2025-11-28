import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { UserProfile } from "@repo/api";

import { ExperimentMemberManagement } from "./experiment-member-management-card";

globalThis.React = React;

/* -------------------------------- Mocks -------------------------------- */

const toastMock = vi.hoisted(() => vi.fn());
const useDebounceMock = vi.hoisted(() => vi.fn());
const useUserSearchMock = vi.hoisted(() => vi.fn());
const useExperimentMembersMock = vi.hoisted(() => vi.fn());
const useExperimentMemberAddMock = vi.hoisted(() => vi.fn());
const useExperimentMemberRemoveMock = vi.hoisted(() => vi.fn());

// --- Regular mocks ---
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "u-admin" } },
  }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: toastMock,
}));

vi.mock("../../hooks/useDebounce", () => ({
  useDebounce: useDebounceMock,
}));

vi.mock("../../hooks/useUserSearch", () => ({
  useUserSearch: useUserSearchMock,
}));

vi.mock("../../hooks/experiment/useExperimentMembers/useExperimentMembers", () => ({
  useExperimentMembers: useExperimentMembersMock,
}));

vi.mock("../../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd", () => ({
  useExperimentMemberAdd: useExperimentMemberAddMock,
}));

vi.mock("../../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove", () => ({
  useExperimentMemberRemove: useExperimentMemberRemoveMock,
}));

vi.mock("../current-members-list/current-members-list", () => ({
  MemberList: ({
    membersWithUserInfo,
    onRemoveMember,
  }: {
    membersWithUserInfo: {
      user: { firstName: string; lastName: string; userId: string };
      role: string;
    }[];
    onRemoveMember: (userId: string) => void;
  }) => (
    <div data-testid="member-list">
      {membersWithUserInfo.map((m) => (
        <div key={m.user.userId}>
          <div>
            {m.user.firstName} {m.user.lastName}
          </div>
          <div>{m.role}</div>
          <button onClick={() => onRemoveMember(m.user.userId)}>Remove</button>
        </div>
      ))}
    </div>
  ),
}));

/* -------------------------------- Test Data -------------------------------- */

const experimentId = "exp-123";

const membersData = [
  {
    role: "admin" as const,
    user: {
      id: "u-admin",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    },
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    role: "member" as const,
    user: {
      id: "u-member",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
    },
    joinedAt: "2024-01-02T00:00:00.000Z",
  },
];

const userProfiles: UserProfile[] = [
  {
    userId: "u-member",
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.com",
    bio: null,
    activated: null,
    organization: undefined,
  },
  {
    userId: "u-free",
    firstName: "Katherine",
    lastName: "Johnson",
    email: "kat@example.com",
    bio: null,
    activated: null,
    organization: undefined,
  },
];

/* -------------------------- Helper Renderer -------------------------- */

function renderWithClient(
  props?: Partial<Omit<React.ComponentProps<typeof ExperimentMemberManagement>, "experimentId">>,
) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ExperimentMemberManagement
        experimentId={experimentId}
        members={membersData}
        isLoading={false}
        isError={false}
        {...props}
      />
    </QueryClientProvider>,
  );
}

/* ------------------------------ Setup ------------------------------ */

beforeEach(() => {
  vi.clearAllMocks();

  useDebounceMock.mockImplementation((v: string) => [v, true]);
  useUserSearchMock.mockImplementation(() => ({
    data: { body: userProfiles },
    isLoading: false,
  }));
  useExperimentMemberAddMock.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
    isPending: false,
  });
  useExperimentMemberRemoveMock.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
    isPending: false,
  });
});

/* ------------------------------- Tests ------------------------------- */

describe("<ExperimentMemberManagement />", () => {
  it("renders loading skeleton", () => {
    renderWithClient({ isLoading: true });
    expect(screen.getByText("experimentSettings.memberManagement")).toBeInTheDocument();
  });

  it("renders error card", () => {
    renderWithClient({ isError: true });
    expect(screen.getByText("experimentSettings.memberManagementError")).toBeInTheDocument();
  });

  it("renders title, description, and existing members", () => {
    renderWithClient();

    expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.collaboratorsDescription")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
  });

  it("adds a member successfully", async () => {
    const addSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentMemberAddMock.mockReturnValue({ mutateAsync: addSpy, isPending: false });

    renderWithClient();

    const input = screen.getByPlaceholderText("experiments.searchUsersPlaceholder");
    fireEvent.change(input, { target: { value: "Kat" } });

    // Wait for the search results to appear
    const katherineButton = await screen.findByRole("button", { name: /Katherine Johnson/i });
    fireEvent.click(katherineButton);

    const addBtn = screen.getByRole("button", { name: "common.add" });
    expect(addBtn).not.toBeDisabled();

    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith({
        params: { id: experimentId },
        body: { members: [{ userId: "u-free", role: "member" }] },
      });
      expect(toastMock).toHaveBeenCalled();
    });
  });

  it("removes a member successfully", async () => {
    const removeSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentMemberRemoveMock.mockReturnValue({ mutateAsync: removeSpy, isPending: false });

    renderWithClient();

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons.length).toBeGreaterThan(0);

    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith({
        params: { id: experimentId, memberId: "u-admin" },
      });
      expect(toastMock).toHaveBeenCalled();
    });
  });

  it("sets loading state when not debounced or fetching users", () => {
    useDebounceMock.mockImplementationOnce((v: string) => [v, false]);
    renderWithClient();

    const addBtn = screen.getByRole("button", { name: "common.add" });
    expect(addBtn).toBeDisabled();

    useDebounceMock.mockImplementationOnce((v: string) => [v, true]);
    useUserSearchMock.mockReturnValueOnce({
      data: { body: userProfiles },
      isLoading: true,
    });

    renderWithClient();
    const addBtns = screen.getAllByRole("button", { name: "common.add" });
    expect(addBtns[addBtns.length - 1]).toBeDisabled();
  });
});
