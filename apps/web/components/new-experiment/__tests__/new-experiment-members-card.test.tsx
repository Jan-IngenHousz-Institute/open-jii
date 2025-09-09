import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import React from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateExperimentBody, UserProfile } from "@repo/api";

import { NewExperimentMembersCard } from "../new-experiment-members-card";

globalThis.React = React;

/* --------------------------------- Types --------------------------------- */

type Member = NonNullable<CreateExperimentBody["members"]>[number];

interface UserSearchCapturedProps {
  availableUsers: UserProfile[];
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddUser: (id: string) => void | Promise<void>;
  isAddingUser: boolean;
}

interface MemberListCapturedProps {
  members: Member[];
  users: UserProfile[];
  onRemoveMember: (id: string) => void;
  isRemovingMember: boolean;
  removingMemberId: string | null;
  adminCount: number;
}

/* --------------------------------- Mocks --------------------------------- */

// i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// session
const sessionUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: sessionUserId } },
  }),
}));

// debounce
const useDebounceMock = vi.fn();
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (v: string) => useDebounceMock(v) as [string, boolean],
}));

const useUserSearchMock = vi.fn();
vi.mock("@/hooks/useUserSearch", () => ({
  useUserSearch: (): { data: { body: UserProfile[] }; isLoading: boolean } =>
    useUserSearchMock() as { data: { body: UserProfile[] }; isLoading: boolean },
}));

let lastUserSearchProps: UserSearchCapturedProps | null = null;

// user search dropdown
vi.mock("../../user-search-with-dropdown", () => ({
  UserSearchWithDropdown: (props: UserSearchCapturedProps) => {
    lastUserSearchProps = props;
    return (
      <div data-testid="user-search">
        <div data-testid="available-count">{props.availableUsers.length}</div>
        <div data-testid="loading-flag">{String(!!props.loading)}</div>
        <button
          type="button"
          onClick={() => props.onAddUser(props.availableUsers[0]?.userId ?? "")}
          data-testid="add-first-user"
          disabled={props.availableUsers.length === 0}
        >
          Add first
        </button>
      </div>
    );
  },
}));

// member list
vi.mock("../current-members-list/current-members-list", () => ({
  MemberList: (props: MemberListCapturedProps) => {
    return (
      <div data-testid="member-list">
        <div data-testid="member-count">{props.members.length}</div>
        <div data-testid="admin-count">{props.adminCount}</div>
        <div data-testid="users-count">{props.users.length}</div>
        {props.members.map((m) => (
          <button
            key={m.userId}
            type="button"
            data-testid={`remove-${m.userId}`}
            onClick={() => props.onRemoveMember(m.userId)}
          >
            remove {m.userId}
          </button>
        ))}
      </div>
    );
  },
}));

/* ------------------------------- Test Data ------------------------------- */

const mkProfile = (over: Partial<UserProfile>): UserProfile => ({
  userId: "00000000-0000-4000-8000-000000000000",
  firstName: "Ada",
  lastName: "Lovelace",
  bio: null,
  organization: undefined,
  email: "ada@example.com",
  ...over,
});

const profiles: UserProfile[] = [
  mkProfile({ userId: sessionUserId, firstName: "Me", lastName: "Myself" }), // current user -> filtered
  mkProfile({
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    firstName: "Grace",
    lastName: "Hopper",
  }),
  mkProfile({
    userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    firstName: "Katherine",
    lastName: "Johnson",
  }),
];

/* ------------------------------- Form Mock ------------------------------- */

let formUpdateCallback: (() => void) | null = null;

function makeForm(initialMembers: Member[] = []): UseFormReturn<CreateExperimentBody> {
  // local mutable state
  let members = [...initialMembers];

  return {
    // only the pieces used by the component
    watch: (name?: string) => {
      if (name === "members") return members;
      return undefined;
    },
    setValue: (name: string, value: unknown) => {
      if (name === "members") {
        members = value as Member[];
        // Trigger a re-render by calling the callback if it exists
        if (formUpdateCallback) formUpdateCallback();
      }
    },
    register: vi.fn() as never,
    unregister: vi.fn(),
    control: {} as never,
    formState: {} as never,
    handleSubmit: vi.fn() as never,
    reset: vi.fn(),
    setError: vi.fn(),
    clearErrors: vi.fn(),
    setFocus: vi.fn(),
    getValues: vi.fn() as never,
    resetField: vi.fn(),
    trigger: vi.fn() as never,
  } as unknown as UseFormReturn<CreateExperimentBody>;
}

/* --------------------------------- Setup -------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();
  lastUserSearchProps = null;
  formUpdateCallback = null;

  useDebounceMock.mockImplementation((v: string): [string, boolean] => [v, true]);
  useUserSearchMock.mockImplementation(() => ({ data: { body: profiles }, isLoading: false }));
});

/* --------------------------------- Tests -------------------------------- */

describe("<NewExperimentMembersCard />", () => {
  it("renders card titles and description", () => {
    const form = makeForm([]);
    render(<NewExperimentMembersCard form={form} />);

    expect(screen.getByText("newExperiment.addMembersTitle")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.addMembersDescription")).toBeInTheDocument();
  });

  it("filters available users to exclude current user and already-added members", () => {
    const already = { userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", role: "member" as const };
    const form = makeForm([already]);
    render(<NewExperimentMembersCard form={form} />);

    const props = lastUserSearchProps;
    const ids = props?.availableUsers.map((u) => u.userId);
    expect(ids).toEqual(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
    expect(screen.getByTestId("available-count")).toHaveTextContent("1");
  });

  it("adds a member via the dropdown and clears selection + search", () => {
    const form = makeForm([]);
    const { rerender } = render(<NewExperimentMembersCard form={form} />);
    formUpdateCallback = () => rerender(<NewExperimentMembersCard form={form} />);

    // before: no members yet
    const countBefore = screen.queryAllByTitle("experimentSettings.removeMember").length;
    expect(countBefore).toBe(0);
    expect(screen.getByText("experimentSettings.noMembersYet")).toBeInTheDocument();

    // add the first available user via the stubbed dropdown
    within(screen.getByTestId("user-search")).getByTestId("add-first-user").click();

    // after: one more member row
    const countAfter = screen.queryAllByTitle("experimentSettings.removeMember").length;
    expect(countAfter).toBe(countBefore + 1);

    // empty state should be gone
    expect(screen.queryByText("experimentSettings.noMembersYet")).not.toBeInTheDocument();

    // controlled clears
    expect(lastUserSearchProps?.value).toBe("");
    expect(lastUserSearchProps?.searchValue).toBe("");
  });

  it("removes a member via MemberList callback", () => {
    const form = makeForm([{ userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "member" }]);
    const { rerender } = render(<NewExperimentMembersCard form={form} />);
    formUpdateCallback = () => rerender(<NewExperimentMembersCard form={form} />);

    // The member name is visible
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    // Click the real remove icon button
    screen.getAllByTitle("experimentSettings.removeMember")[0].click();

    // The member should be gone
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
  });

  it("computes adminCount from members with role=admin", () => {
    const initial: Member[] = [
      { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "admin" },
      { userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", role: "admin" },
      { userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", role: "member" },
    ];
    const form = makeForm(initial);
    render(<NewExperimentMembersCard form={form} />);

    // Count badges with text "admin"
    const adminBadges = screen.getAllByText("admin");
    expect(adminBadges.length).toBe(2);
  });

  it("sets loading=true when not debounced OR user search is fetching", () => {
    // case 1: not debounced
    useDebounceMock.mockImplementation((v: string): [string, boolean] => [v, false]);
    const form = makeForm([]);
    render(<NewExperimentMembersCard form={form} />);
    expect(screen.getByTestId("loading-flag")).toHaveTextContent("true");

    // case 2: debounced but fetching
    useDebounceMock.mockImplementation((v: string): [string, boolean] => [v, true]);
    useUserSearchMock.mockImplementation(() => ({ data: { body: profiles }, isLoading: true }));
    render(<NewExperimentMembersCard form={form} />);
    expect(screen.getAllByTestId("loading-flag")[1]).toHaveTextContent("true");
  });
});
