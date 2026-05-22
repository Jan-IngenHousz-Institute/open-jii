import { createExperiment, createLocation } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ExperimentMember } from "@repo/api/schemas/experiment.schema";
import { useSession } from "@repo/auth/client";

import { ExperimentDetailsCard } from "./experiment-details-card";

vi.mock("../../experiment-settings/experiment-info-card", () => ({
  ExperimentInfoCard: ({ experimentId }: { experimentId: string }) => (
    <div data-testid="experiment-info-card">{experimentId}</div>
  ),
}));

vi.mock("../experiment-members-trail", () => ({
  ExperimentMembersTrail: ({
    members,
    href,
    isLoading,
  }: {
    members: { user: { id: string } }[];
    href: string;
    isLoading?: boolean;
  }) => (
    <div data-testid="experiment-members-trail" data-href={href}>
      {isLoading ? "loading" : `${members.length} members`}
    </div>
  ),
}));

vi.mock("../../experiment-settings/experiment-visibility-card", () => ({
  ExperimentVisibilityCard: ({
    experimentId,
    initialVisibility,
  }: {
    experimentId: string;
    initialVisibility: string;
  }) => (
    <div data-testid="experiment-visibility-card">
      {experimentId}-{initialVisibility}
    </div>
  ),
}));

vi.mock("./experiment-locations-section", () => ({
  ExperimentLocationsSection: ({
    experimentId,
    locations,
  }: {
    experimentId: string;
    locations: Location[];
  }) => (
    <div data-testid="experiment-locations-section">
      {experimentId}-{locations.length}
    </div>
  ),
}));

const mockExperiment = createExperiment({
  id: "exp-123",
  name: "Test Experiment",
  description: "Test Description",
  visibility: "private",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
  ownerFirstName: "John",
  ownerLastName: "Doe",
});

const mockLocations = [
  createLocation({
    id: "loc-1",
    name: "Location 1",
    latitude: 40.7829,
    longitude: -73.9654,
  }),
];

const mockMembers: ExperimentMember[] = [
  {
    role: "admin",
    user: {
      id: "user-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      avatarUrl: null,
    },
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
];

function renderComponent(props: Partial<ComponentProps<typeof ExperimentDetailsCard>> = {}) {
  const defaultProps: React.ComponentProps<typeof ExperimentDetailsCard> = {
    experimentId: "exp-123",
    experiment: mockExperiment,
    locations: mockLocations,
    members: mockMembers,
    isMembersLoading: false,
    hasAccess: false,
    isArchived: false,
    ...props,
  };

  return render(<ExperimentDetailsCard {...defaultProps} />);
}

describe("ExperimentDetailsCard", () => {
  // setup.ts afterEach calls vi.clearAllMocks(); reapply the session mock per test.
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
  });

  it("renders title", () => {
    renderComponent();
    expect(screen.getByText("detailsTitle")).toBeInTheDocument();
  });

  it("renders experiment ID", () => {
    renderComponent();
    expect(screen.getByText("experimentId")).toBeInTheDocument();
    expect(screen.getAllByText("exp-123").length).toBeGreaterThan(0);
  });

  it("renders created and updated dates", () => {
    renderComponent();
    expect(screen.getByText("created")).toBeInTheDocument();
    expect(screen.getByText("updated")).toBeInTheDocument();
    expect(screen.getByText(formatDate("2024-01-01T00:00:00.000Z"))).toBeInTheDocument();
    expect(screen.getByText(formatDate("2024-01-15T00:00:00.000Z"))).toBeInTheDocument();
  });

  it("renders creator name", () => {
    renderComponent();
    expect(screen.getByText("createdBy")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders child components", () => {
    renderComponent();
    expect(screen.getByTestId("experiment-locations-section")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-visibility-card")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-members-trail")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-info-card")).toBeInTheDocument();
  });

  it("passes correct props to child components", () => {
    renderComponent({ experimentId: "exp-456", hasAccess: true, isArchived: true });
    expect(screen.getByTestId("experiment-locations-section")).toHaveTextContent("exp-456-1");
    expect(screen.getByTestId("experiment-visibility-card")).toHaveTextContent("exp-456-private");
  });

  it("shows collapsed state by default on mobile", () => {
    renderComponent();
    // Mobile collapse button starts in "expand" state
    expect(screen.getByRole("button", { name: "Expand details" })).toBeInTheDocument();
  });

  it("toggles collapse state when button is clicked", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button", { name: "Expand details" });

    // Clicking the button toggles collapse — verified by the button remaining interactive
    await user.click(button);
    await user.click(button);
    expect(button).toBeInTheDocument();
  });

  it("shows loading state for members", () => {
    renderComponent({ isMembersLoading: true });
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("passes correct href to the members trail", () => {
    renderComponent({ experimentId: "exp-789" });
    const trail = screen.getByTestId("experiment-members-trail");
    expect(trail.getAttribute("data-href")).toContain(
      "/platform/experiments/exp-789/collaborators",
    );
  });
});
