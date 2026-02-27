import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import { ExperimentMemberManagement } from "./experiment-member-management-card";

// Override global auth mock with a logged-in admin
beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "u-admin" } },
  } as ReturnType<typeof useSession>);
});

// Pragmatic exception – timer utility (useDebounce needs fake timers otherwise)
vi.mock("../../hooks/useDebounce", () => ({
  useDebounce: (v: string) => [v, true],
}));

// Rule 5 – sibling component mock (MemberList has its own tests)
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
    <div>
      {membersWithUserInfo.map((m) => (
        <div key={m.user.userId}>
          <span>
            {m.user.firstName} {m.user.lastName}
          </span>
          <span>{m.role}</span>
          <button onClick={() => onRemoveMember(m.user.userId)}>Remove</button>
        </div>
      ))}
    </div>
  ),
}));

const experimentId = "exp-123";

const members = [
  {
    role: "admin" as const,
    user: { id: "u-admin", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    role: "member" as const,
    user: { id: "u-member", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" },
    joinedAt: "2024-01-02T00:00:00.000Z",
  },
];

function mountUserSearch() {
  return server.mount(contract.users.searchUsers, {
    body: [
      createUserProfile({ userId: "u-member", firstName: "Grace", lastName: "Hopper" }),
      createUserProfile({ userId: "u-free", firstName: "Katherine", lastName: "Johnson" }),
    ],
  });
}

function mountAddMember() {
  return server.mount(contract.experiments.addExperimentMembers, {
    body: [],
    status: 201,
  });
}

function mountRemoveMember() {
  return server.mount(contract.experiments.removeExperimentMember);
}

describe("ExperimentMemberManagement", () => {
  it("renders loading skeleton", () => {
    render(
      <ExperimentMemberManagement
        experimentId={experimentId}
        members={[]}
        isLoading={true}
        isError={false}
      />,
    );

    expect(screen.getByText("experimentSettings.memberManagement")).toBeInTheDocument();
  });

  it("renders error card", () => {
    render(
      <ExperimentMemberManagement
        experimentId={experimentId}
        members={[]}
        isLoading={false}
        isError={true}
      />,
    );

    expect(screen.getByText("experimentSettings.memberManagementError")).toBeInTheDocument();
  });

  it("renders title, description, and existing members", () => {
    render(
      <ExperimentMemberManagement
        experimentId={experimentId}
        members={members}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.collaboratorsDescription")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("adds a member successfully", async () => {
    mountUserSearch();
    const addSpy = mountAddMember();

    render(
      <ExperimentMemberManagement
        experimentId={experimentId}
        members={members}
        isLoading={false}
        isError={false}
      />,
    );

    const input = screen.getByPlaceholderText("experiments.searchUsersPlaceholder");
    const user = userEvent.setup();
    await user.type(input, "Kat");

    const katherineButton = await screen.findByRole("button", { name: /Katherine Johnson/i });
    await user.click(katherineButton);

    await user.click(screen.getByRole("button", { name: "common.add" }));

    await waitFor(() => {
      expect(addSpy.callCount).toBe(1);
      expect(toast).toHaveBeenCalled();
    });
  });

  it("removes a member", async () => {
    const removeSpy = mountRemoveMember();

    render(
      <ExperimentMemberManagement
        experimentId={experimentId}
        members={members}
        isLoading={false}
        isError={false}
      />,
    );

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    const user = userEvent.setup();
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(removeSpy.callCount).toBe(1);
      expect(toast).toHaveBeenCalled();
    });
  });
});
