import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, expect, it, vi } from "vitest";

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

describe("ExperimentInfoCard", () => {
  it("renders archive and delete for admin", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-1" } } } as never);
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<ExperimentInfoCard experimentId="exp-1" experiment={experiment} canManage />);

    expect(screen.getByTestId("archive")).toBeInTheDocument();
    expect(screen.getByTestId("delete")).toBeInTheDocument();
  });

  it("shows danger zone note", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-1" } } } as never);
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    render(<ExperimentInfoCard experimentId="exp-1" experiment={experiment} canManage />);

    expect(screen.getByText("experimentSettings.dangerZoneNote_deleteAllowed")).toBeInTheDocument();
  });

  it("hides archive without can(manage)", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-1" } } } as never);
    render(<ExperimentInfoCard experimentId="exp-1" experiment={experiment} canManage={false} />);

    expect(screen.queryByTestId("archive")).not.toBeInTheDocument();
  });
});
