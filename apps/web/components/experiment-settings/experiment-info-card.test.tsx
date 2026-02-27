import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentMember } from "@repo/api";
import { useSession } from "@repo/auth/client";

import { ExperimentInfoCard } from "./experiment-info-card";

vi.mock("./experiment-archive", () => ({
  ExperimentArchive: (props: { experimentId: string }) => (
    <div data-testid="archive">{props.experimentId}</div>
  ),
}));

vi.mock("./experiment-delete", () => ({
  ExperimentDelete: (props: { experimentName: string }) => (
    <div data-testid="delete">{props.experimentName}</div>
  ),
}));

const experiment = createExperiment({ id: "exp-1", name: "Test", status: "active" });
const members: ExperimentMember[] = [
  {
    role: "admin",
    user: { id: "user-1", firstName: "Test", lastName: "Admin", email: "admin@test.com" },
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
];

describe("ExperimentInfoCard", () => {
  it("renders archive and delete for admin", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-1" } } } as never);
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<ExperimentInfoCard experimentId="exp-1" experiment={experiment} members={members} />);

    expect(screen.getByTestId("archive")).toBeInTheDocument();
    expect(screen.getByTestId("delete")).toBeInTheDocument();
  });

  it("shows danger zone note", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-1" } } } as never);
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<ExperimentInfoCard experimentId="exp-1" experiment={experiment} members={members} />);

    expect(screen.getByText("experimentSettings.dangerZoneNote_deleteAllowed")).toBeInTheDocument();
  });

  it("hides archive for non-admin", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-1" } } } as never);
    const nonAdminMembers: ExperimentMember[] = [
      {
        role: "member",
        user: { id: "user-1", firstName: "Test", lastName: "Member", email: "member@test.com" },
        joinedAt: "2024-01-01T00:00:00.000Z",
      },
    ];
    render(
      <ExperimentInfoCard experimentId="exp-1" experiment={experiment} members={nonAdminMembers} />,
    );

    expect(screen.queryByTestId("archive")).not.toBeInTheDocument();
  });
});
