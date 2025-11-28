import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Experiment, ExperimentMember, Location } from "@repo/api";

import { ExperimentDetailsCard } from "./experiment-details-card";

globalThis.React = React;

// ---------- Mocks ----------
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/util/date", () => ({
  formatDate: (date: string) => date,
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

vi.mock("lucide-react", () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="icon-chevron-up">ChevronUp</span>,
}));

vi.mock("../../experiment-settings/experiment-info-card", () => ({
  ExperimentInfoCard: ({ experimentId }: { experimentId: string }) => (
    <div data-testid="experiment-info-card">{experimentId}</div>
  ),
}));

vi.mock("../../experiment-settings/experiment-member-management-card", () => ({
  ExperimentMemberManagement: ({
    experimentId,
    isLoading,
    isError,
  }: {
    experimentId: string;
    isLoading: boolean;
    isError: boolean;
  }) => (
    <div data-testid="experiment-member-management">
      {isLoading ? "loading" : isError ? "error" : experimentId}
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

// ---------- Test Data ----------
const mockExperiment: Experiment = {
  id: "exp-123",
  name: "Test Experiment",
  description: "Test Description",
  status: "active",
  visibility: "private",
  createdBy: "user-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
  embargoUntil: "2025-12-31T23:59:59.999Z",
  ownerFirstName: "John",
  ownerLastName: "Doe",
};

const mockLocations: Location[] = [
  {
    id: "loc-1",
    name: "Location 1",
    latitude: 40.7829,
    longitude: -73.9654,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

const mockMembers: ExperimentMember[] = [
  {
    role: "admin",
    user: { id: "user-1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
];

// ---------- Helpers ----------
function renderComponent(props: Partial<React.ComponentProps<typeof ExperimentDetailsCard>> = {}) {
  const defaultProps: React.ComponentProps<typeof ExperimentDetailsCard> = {
    experimentId: "exp-123",
    experiment: mockExperiment,
    locations: mockLocations,
    members: mockMembers,
    isMembersLoading: false,
    isMembersError: false,
    hasAccess: false,
    isArchived: false,
    ...props,
  };

  return render(<ExperimentDetailsCard {...defaultProps} />);
}

describe("ExperimentDetailsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText("2024-01-01T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("2024-01-15T00:00:00.000Z")).toBeInTheDocument();
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
    expect(screen.getByTestId("experiment-member-management")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-info-card")).toBeInTheDocument();
  });

  it("passes correct props to child components", () => {
    renderComponent({ experimentId: "exp-456", hasAccess: true, isArchived: true });
    expect(screen.getByTestId("experiment-locations-section")).toHaveTextContent("exp-456-1");
    expect(screen.getByTestId("experiment-visibility-card")).toHaveTextContent("exp-456-private");
  });

  it("shows collapsed state by default on mobile", () => {
    renderComponent();
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
  });

  it("toggles collapse state when button is clicked", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button");
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();

    await user.click(button);
    expect(screen.getByTestId("icon-chevron-up")).toBeInTheDocument();

    await user.click(button);
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
  });

  it("shows loading state for members", () => {
    renderComponent({ isMembersLoading: true });
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("shows error state for members", () => {
    renderComponent({ isMembersError: true });
    expect(screen.getByText("error")).toBeInTheDocument();
  });
});
