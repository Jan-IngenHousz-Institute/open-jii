import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { ExperimentMemberManagement } from "./experiment-member-management-card";

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "u-admin" } },
  } as ReturnType<typeof useSession>);
});

vi.mock("./experiment-members-panel", () => ({
  ExperimentMembersPanel: () => <div data-testid="members-panel" />,
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

function mountInvitations() {
  server.mount(contract.users.listInvitations, { body: [] });
}

function mountJoinRequests() {
  server.mount(contract.experiments.listJoinRequests, { body: [] });
}

describe("ExperimentMemberManagement", () => {
  it("renders loading skeleton", () => {
    mountInvitations();
    mountJoinRequests();
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
    mountInvitations();
    mountJoinRequests();
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

  it("renders title, description, and tab structure", () => {
    mountInvitations();
    mountJoinRequests();
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
    expect(screen.getByRole("tab", { name: /membersTab/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /invitedTab/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /requestsTab/i })).toBeInTheDocument();
    expect(screen.getByTestId("members-panel")).toBeInTheDocument();
  });

  it("disables invited and requests tabs for non-admins", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u-member" } },
    } as ReturnType<typeof useSession>);

    mountInvitations();
    mountJoinRequests();
    render(
      <ExperimentMemberManagement
        experimentId={experimentId}
        members={members}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByRole("tab", { name: /invitedTab/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /requestsTab/i })).toBeDisabled();
  });
});
