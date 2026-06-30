import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExperimentMembersPanel } from "./experiment-members-panel";

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "u-admin" } },
  } as ReturnType<typeof useSession>);
});

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
    user: {
      id: "u-admin",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
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
      avatarUrl: null,
    },
    joinedAt: "2024-01-02T00:00:00.000Z",
  },
];

const defaultProps = {
  experimentId,
  members,
  currentUserRole: "admin" as const,
  currentUserId: "u-admin",
  isArchived: false,
  adminCount: 1,
};

function mountRemoveMember() {
  return server.mount(orpcContract.experiments.removeExperimentMember);
}

describe("ExperimentMembersPanel", () => {
  it("renders existing members", () => {
    render(<ExperimentMembersPanel {...defaultProps} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
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
});
