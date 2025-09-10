import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentMemberManagement } from "../experiment-member-management-card";

globalThis.React = React;

/* -------------------------------- Types -------------------------------- */

interface Member {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  role: "admin" | "member";
  joinedAt?: string;
}

interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  bio: null;
  organization?: string | undefined;
}

/* ----------------------------- Captured props ---------------------------- */

let lastUserSearchProps: {
  availableUsers: UserProfile[];
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddUser: (id?: string) => void | Promise<void>;
  isAddingUser: boolean;
} | null = null;

/* --------------------------------- Mocks -------------------------------- */

// hoisted mocks
const toastMock = vi.hoisted(() => vi.fn());
const useExperimentMembersMock = vi.hoisted(() => vi.fn());
const useExperimentMemberAddMock = vi.hoisted(() => vi.fn());
const useExperimentMemberRemoveMock = vi.hoisted(() => vi.fn());
const useDebounceMock = vi.hoisted(() => vi.fn());
const useUserSearchMock = vi.hoisted(() => vi.fn());

// i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: toastMock,
}));

vi.mock("../../../hooks/experiment/useExperimentMembers/useExperimentMembers", () => ({
  useExperimentMembers: useExperimentMembersMock,
}));

vi.mock("../../../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd", () => ({
  useExperimentMemberAdd: useExperimentMemberAddMock,
}));

vi.mock("../../../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove", () => ({
  useExperimentMemberRemove: useExperimentMemberRemoveMock,
}));

vi.mock("../../../hooks/useDebounce", () => ({
  useDebounce: useDebounceMock,
}));

vi.mock("../../../hooks/useUserSearch", () => ({
  useUserSearch: useUserSearchMock,
}));

vi.mock("../../user-search-with-dropdown", () => ({
  UserSearchWithDropdown: (props: NonNullable<typeof lastUserSearchProps>) => {
    lastUserSearchProps = {
      ...props,
      onValueChange: (v: string) => {
        props.onValueChange(v);
        lastUserSearchProps = { ...props, value: v };
      },
    };
    return (
      <div data-testid="user-search">
        <div data-testid="available-count">{props.availableUsers.length}</div>
        <div data-testid="loading-flag">{String(!!props.loading)}</div>
        <div data-testid="current-value">{props.value}</div>
        <button
          type="button"
          data-testid="add-first-user"
          disabled={props.availableUsers.length === 0}
          onClick={() => props.onAddUser(props.availableUsers[0]?.userId)}
        >
          Add first
        </button>
        <button
          type="button"
          data-testid="set-user-value"
          onClick={() => props.onValueChange("u-free")}
        >
          Select u-free
        </button>
      </div>
    );
  },
}));

/* ------------------------------- Test Data ------------------------------- */

const experimentId = "exp-123";

const membersBody: Member[] = [
  {
    role: "admin",
    user: { id: "u-admin", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  },
  {
    role: "member",
    user: { id: "u-member", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" },
  },
];

const userProfiles: UserProfile[] = [
  {
    userId: "u-member",
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.com",
    bio: null,
    organization: undefined,
  },
  {
    userId: "u-free",
    firstName: "Katherine",
    lastName: "Johnson",
    email: "kat@example.com",
    bio: null,
    organization: undefined,
  },
];

/* -------------------------- Helpers -------------------------- */

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const defaultMockReturns = {
  members: { data: { body: membersBody }, isLoading: false, isError: false },
  userSearch: { data: { body: userProfiles }, isLoading: false },
  memberAdd: { mutateAsync: vi.fn().mockResolvedValue({ ok: true }), isPending: false },
  memberRemove: { mutateAsync: vi.fn().mockResolvedValue({ ok: true }), isPending: false },
};

/* --------------------------------- Setup -------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();
  lastUserSearchProps = null;

  useExperimentMembersMock.mockReturnValue(defaultMockReturns.members);
  useDebounceMock.mockImplementation((v: string) => [v, true]);
  useUserSearchMock.mockReturnValue(defaultMockReturns.userSearch);
  useExperimentMemberAddMock.mockReturnValue(defaultMockReturns.memberAdd);
  useExperimentMemberRemoveMock.mockReturnValue(defaultMockReturns.memberRemove);
});

/* --------------------------------- Tests -------------------------------- */

describe("<ExperimentMemberManagement />", () => {
  it("renders loading skeleton when members are loading", () => {
    useExperimentMembersMock.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderWithClient(<ExperimentMemberManagement experimentId={experimentId} />);

    expect(screen.getByText("experimentSettings.memberManagement")).toBeInTheDocument();
  });

  it("renders error card when members fail to load", () => {
    useExperimentMembersMock.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderWithClient(<ExperimentMemberManagement experimentId={experimentId} />);

    expect(screen.getByText("experimentSettings.memberManagement")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.memberManagementError")).toBeInTheDocument();
  });

  it("renders title/description and shows member information (real MemberList)", () => {
    renderWithClient(<ExperimentMemberManagement experimentId={experimentId} />);

    expect(screen.getByText("experimentSettings.memberManagement")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.memberDescription")).toBeInTheDocument();

    // Member names should be visible (from real MemberList)
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    // Roles should be visible (Badge text inside MemberList)
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
  });

  it("filters available users to exclude already-added members (by user.id)", () => {
    renderWithClient(<ExperimentMemberManagement experimentId={experimentId} />);

    const ids = lastUserSearchProps?.availableUsers.map((u) => u.userId) ?? [];
    expect(ids).toEqual(["u-free"]);
    expect(screen.getByTestId("available-count")).toHaveTextContent("1");
  });

  it("invokes addMember with the correct payload and clears selected user", async () => {
    const addSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentMemberAddMock.mockReturnValue({ mutateAsync: addSpy, isPending: false });

    renderWithClient(<ExperimentMemberManagement experimentId={experimentId} />);

    const user = userEvent.setup();

    // Select a user first via our controlled mock
    await user.click(within(screen.getByTestId("user-search")).getByTestId("set-user-value"));
    expect(screen.getByTestId("current-value")).toHaveTextContent("u-free");

    // Add the user
    await lastUserSearchProps?.onAddUser();

    expect(addSpy).toHaveBeenCalledWith({
      params: { id: experimentId },
      body: { members: [{ userId: "u-free", role: "member" }] },
    });

    await waitFor(() => expect(screen.getByTestId("current-value")).toHaveTextContent(""));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
  });

  it("invokes removeMember with the correct payload (clicks real remove button for non-admin)", async () => {
    const removeSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentMemberRemoveMock.mockReturnValueOnce({ mutateAsync: removeSpy, isPending: false });

    renderWithClient(<ExperimentMemberManagement experimentId={experimentId} />);

    // We search by role=button and look for 'remove' in text/aria-label/title.
    const allButtons = screen.getAllByRole("button");
    const removeBtn =
      allButtons.find(
        (b) =>
          !b.hasAttribute("disabled") &&
          /remove/i.test(
            (b.textContent ?? "") +
              (b.getAttribute("aria-label") ?? "") +
              (b.getAttribute("title") ?? ""),
          ),
      ) ?? allButtons.reverse().find((b) => !b.hasAttribute("disabled"));

    expect(removeBtn).toBeTruthy();
    if (removeBtn) {
      await userEvent.click(removeBtn);
    }

    expect(removeSpy).toHaveBeenCalledWith({
      params: { id: experimentId, memberId: "u-member" },
    });
    expect(toastMock).toHaveBeenCalled();
  });

  it("sets user search dropdown loading=true when not debounced OR user search is fetching", () => {
    useDebounceMock.mockImplementationOnce((v: string) => [v, false]);
    renderWithClient(<ExperimentMemberManagement experimentId={experimentId} />);
    expect(screen.getByTestId("loading-flag")).toHaveTextContent("true");

    useDebounceMock.mockImplementationOnce((v: string) => [v, true]);
    useUserSearchMock.mockReturnValueOnce({ data: { body: userProfiles }, isLoading: true });
    renderWithClient(<ExperimentMemberManagement experimentId={experimentId} />);
    const flags = screen.getAllByTestId("loading-flag");
    expect(flags[flags.length - 1]).toHaveTextContent("true");
  });
});
