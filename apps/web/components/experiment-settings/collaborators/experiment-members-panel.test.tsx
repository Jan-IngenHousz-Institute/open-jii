import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExperimentMembersPanel } from "./experiment-members-panel";

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "u-admin" } },
  } as ReturnType<typeof useSession>);
});

vi.mock("../../hooks/useDebounce", () => ({
  useDebounce: (v: string) => [v, true],
}));

vi.mock("../../current-members-list/current-members-list", () => ({
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

const defaultProps = {
  experimentId,
  members,
  invitations: [],
  currentUserRole: "admin" as const,
  currentUserId: "u-admin",
  isArchived: false,
  adminCount: 1,
};

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

describe("ExperimentMembersPanel", () => {
  it("renders existing members", () => {
    render(<ExperimentMembersPanel {...defaultProps} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("adds a member successfully", async () => {
    mountUserSearch();
    const addSpy = mountAddMember();

    render(<ExperimentMembersPanel {...defaultProps} />);

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

    render(<ExperimentMembersPanel {...defaultProps} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    const user = userEvent.setup();
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(removeSpy.callCount).toBe(1);
      expect(toast).toHaveBeenCalled();
    });
  });

  it("disables add button when not admin", () => {
    render(<ExperimentMembersPanel {...defaultProps} currentUserRole="member" />);

    expect(screen.getByRole("button", { name: "common.add" })).toBeDisabled();
  });

  it("disables add button when archived", () => {
    render(<ExperimentMembersPanel {...defaultProps} isArchived={true} />);

    expect(screen.getByRole("button", { name: "common.add" })).toBeDisabled();
  });
});
