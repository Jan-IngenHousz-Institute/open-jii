import "@testing-library/jest-dom";
import { render, screen, within, act } from "@testing-library/react";
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

// i18n labels
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) =>
      ({
        "newExperiment.addMembersTitle": "Add members",
        "newExperiment.addMembersDescription": "Invite teammates to your experiment.",
        "newExperiment.addMemberPlaceholder": "Search or paste an email",
      })[k] ?? k,
  }),
}));

// UI
vi.mock("@repo/ui/components", () => {
  const Card = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  );
  const CardHeader = ({ children }: React.PropsWithChildren) => (
    <div data-testid="card-header">{children}</div>
  );
  const CardTitle = ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="card-title">{children}</h2>
  );
  const CardDescription = ({ children }: React.PropsWithChildren) => (
    <p data-testid="card-desc">{children}</p>
  );
  const CardContent = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  );
  return { Card, CardHeader, CardTitle, CardDescription, CardContent };
});

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
let lastMemberListProps: MemberListCapturedProps | null = null;

// user search dropdown stub
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
vi.mock("../../current-members-list", () => ({
  MemberList: (props: MemberListCapturedProps) => {
    lastMemberListProps = props;
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
  mkProfile({ userId: sessionUserId, firstName: "Me", lastName: "Myself" }), // current user -> should be filtered
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
      // our component only calls watch("members")
      if (name === "members") return members;
      return undefined;
    },
    setValue: (name: string, value: unknown) => {
      if (name === "members") {
        members = value as Member[];
        // Trigger a re-render by calling the callback if it exists
        if (formUpdateCallback) {
          formUpdateCallback();
        }
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
  lastMemberListProps = null;
  formUpdateCallback = null;

  useDebounceMock.mockImplementation((v: string): [string, boolean] => [v, true]);
  useUserSearchMock.mockImplementation(() => ({ data: { body: profiles }, isLoading: false }));
});

/* --------------------------------- Tests -------------------------------- */

describe("<NewExperimentMembersCard />", () => {
  it("renders card titles and description", () => {
    const form = makeForm([]);
    render(<NewExperimentMembersCard form={form} />);
    expect(screen.getByTestId("card-title")).toHaveTextContent("Add members");
    expect(screen.getByTestId("card-desc")).toHaveTextContent(
      "Invite teammates to your experiment.",
    );
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

    act(() => {
      within(screen.getByTestId("user-search")).getByTestId("add-first-user").click();
    });

    // member list should now have 1 member, and adminCount stays 0
    expect(screen.getByTestId("member-count")).toHaveTextContent("1");
    expect(screen.getByTestId("admin-count")).toHaveTextContent("0");

    // after add, component clears selectedUserId + userSearch
    const props = lastUserSearchProps;
    expect(props?.value).toBe("");
    expect(props?.searchValue).toBe("");

    // users passed to MemberList should include the newly added profile and other search results
    const ml = lastMemberListProps;
    const userIds = ml?.users.map((u) => u.userId);
    expect(userIds).toEqual(
      expect.arrayContaining([
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ]),
    );
  });

  it("removes a member via MemberList callback", () => {
    const form = makeForm([{ userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "member" }]);
    const { rerender } = render(<NewExperimentMembersCard form={form} />);

    formUpdateCallback = () => rerender(<NewExperimentMembersCard form={form} />);

    // one member visible now
    expect(screen.getByTestId("member-count")).toHaveTextContent("1");

    // click remove
    act(() => {
      screen.getByTestId("remove-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb").click();
    });

    // list should be empty now
    expect(screen.getByTestId("member-count")).toHaveTextContent("0");
  });

  it("computes adminCount from members with role=admin", () => {
    const initial: Member[] = [
      { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "admin" },
      { userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", role: "admin" },
      { userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", role: "member" },
    ];
    const form = makeForm(initial);
    render(<NewExperimentMembersCard form={form} />);
    expect(screen.getByTestId("admin-count")).toHaveTextContent("2");
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
