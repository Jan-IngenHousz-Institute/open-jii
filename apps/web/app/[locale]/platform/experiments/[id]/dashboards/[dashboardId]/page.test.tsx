import { DashboardModeProvider } from "@/components/experiment-dashboards/dashboard-mode-context";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import after mocks register so the page picks up the stubs.
import DashboardPage from "./page";

// SUT is a thin dispatcher: mode picks one of two bodies. Stub them so we
// don't drag the full form/canvas tree into this test file.
vi.mock("@/components/experiment-dashboards/dashboard-view-body", () => ({
  DashboardViewBody: ({
    experimentId,
    dashboardId,
  }: {
    experimentId: string;
    dashboardId: string;
  }) => <div data-testid="view-body" data-experiment={experimentId} data-dashboard={dashboardId} />,
}));

vi.mock("@/components/experiment-dashboards/editor/dashboard-editor-body", () => ({
  DashboardEditorBody: ({ experimentId }: { experimentId: string }) => (
    <div data-testid="editor-body" data-experiment={experimentId} />
  ),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ id: "exp-1", dashboardId: "dash-9" });
  });

  it("renders the view body by default", () => {
    render(
      <DashboardModeProvider>
        <DashboardPage />
      </DashboardModeProvider>,
    );
    const body = screen.getByTestId("view-body");
    expect(body).toBeInTheDocument();
    expect(body).toHaveAttribute("data-experiment", "exp-1");
    expect(body).toHaveAttribute("data-dashboard", "dash-9");
    expect(screen.queryByTestId("editor-body")).not.toBeInTheDocument();
  });

  it("renders the editor body when initial mode is edit", () => {
    render(
      <DashboardModeProvider initialMode="edit">
        <DashboardPage />
      </DashboardModeProvider>,
    );
    const body = screen.getByTestId("editor-body");
    expect(body).toBeInTheDocument();
    expect(body).toHaveAttribute("data-experiment", "exp-1");
    expect(screen.queryByTestId("view-body")).not.toBeInTheDocument();
  });

  it("forwards both the experimentId and dashboardId to the view body", () => {
    vi.mocked(useParams).mockReturnValue({ id: "other-exp", dashboardId: "other-dash" });
    render(
      <DashboardModeProvider>
        <DashboardPage />
      </DashboardModeProvider>,
    );
    expect(screen.getByTestId("view-body")).toHaveAttribute("data-experiment", "other-exp");
    expect(screen.getByTestId("view-body")).toHaveAttribute("data-dashboard", "other-dash");
  });
});
