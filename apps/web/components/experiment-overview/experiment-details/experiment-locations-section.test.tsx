import { createLocation } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { Location } from "@repo/api";

import { ExperimentLocationsSection } from "./experiment-locations-section";

/* --------------------------------- Mocks -------------------------------- */

vi.mock("../../experiment-settings/experiment-location-management-card", () => ({
  ExperimentLocationManagement: (props: Record<string, unknown>) => (
    <div data-testid="experiment-location-management" {...props} />
  ),
}));

vi.mock("../../map", () => ({
  Map: () => <div data-testid="map" />,
}));

/* ------------------------------- Test Data ------------------------------- */

const mockLocations = {
  one: [createLocation({ id: "loc-1", name: "Location 1", latitude: 40.7128, longitude: -74.006 })],
  two: [
    createLocation({ id: "loc-1", name: "Location 1", latitude: 40.7128, longitude: -74.006 }),
    createLocation({ id: "loc-2", name: "Location 2", latitude: 34.0522, longitude: -118.2437 }),
  ],
  three: [
    createLocation({ id: "loc-1", name: "Location 1", latitude: 40.7128, longitude: -74.006 }),
    createLocation({ id: "loc-2", name: "Location 2", latitude: 34.0522, longitude: -118.2437 }),
    createLocation({ id: "loc-3", name: "Location 3", latitude: 41.8781, longitude: -87.6298 }),
  ],
};

/* --------------------------------- Tests -------------------------------- */

describe("ExperimentLocationsSection", () => {
  it("renders title", () => {
    const locations: Location[] = [];
    render(<ExperimentLocationsSection experimentId="exp-123" locations={locations} />);

    expect(screen.getByText("details.location.locationsTitle")).toBeInTheDocument();
  });

  it("renders manage button when user has access and not archived", () => {
    const locations: Location[] = [];
    render(
      <ExperimentLocationsSection
        experimentId="exp-123"
        locations={locations}
        hasAccess={true}
        isArchived={false}
      />,
    );

    expect(screen.getByText("Manage")).toBeInTheDocument();
  });

  it("renders view button when user has no access", () => {
    const locations: Location[] = [];
    render(
      <ExperimentLocationsSection experimentId="exp-123" locations={locations} hasAccess={false} />,
    );

    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("renders view button when experiment is archived", () => {
    const locations: Location[] = [];
    render(
      <ExperimentLocationsSection
        experimentId="exp-123"
        locations={locations}
        hasAccess={true}
        isArchived={true}
      />,
    );

    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("renders no locations message when locations array is empty", () => {
    const locations: Location[] = [];
    render(<ExperimentLocationsSection experimentId="exp-123" locations={locations} />);

    expect(screen.getByText("details.location.noLocationsAdded")).toBeInTheDocument();
  });

  it("renders location names when locations are provided", () => {
    render(<ExperimentLocationsSection experimentId="exp-123" locations={mockLocations.two} />);

    expect(screen.getByText("Location 1")).toBeInTheDocument();
    expect(screen.getByText("Location 2")).toBeInTheDocument();
  });

  it("renders map when locations are provided", () => {
    render(<ExperimentLocationsSection experimentId="exp-123" locations={mockLocations.one} />);

    expect(screen.getByTestId("map")).toBeInTheDocument();
  });

  it("does not render map when no locations", () => {
    const locations: Location[] = [];
    render(<ExperimentLocationsSection experimentId="exp-123" locations={locations} />);

    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });

  it("shows other locations message when more than 2 locations", () => {
    render(<ExperimentLocationsSection experimentId="exp-123" locations={mockLocations.three} />);

    expect(screen.getByText(/and/)).toBeInTheDocument();
    expect(screen.getByText(/details.location.otherLocations/)).toBeInTheDocument();
  });

  it("opens dialog when manage/view button is clicked", async () => {
    const user = userEvent.setup();
    const locations: Location[] = [];
    render(<ExperimentLocationsSection experimentId="exp-123" locations={locations} />);

    const button = screen.getByText("View");
    await user.click(button);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("opens dialog when map is clicked", async () => {
    const user = userEvent.setup();
    render(<ExperimentLocationsSection experimentId="exp-123" locations={mockLocations.one} />);

    const mapOverlay = screen.getByTestId("map").parentElement?.querySelector("div");
    if (mapOverlay) {
      await user.click(mapOverlay);
    }

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
