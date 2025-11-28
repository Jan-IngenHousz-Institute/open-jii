import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Location } from "@repo/api";

import { ExperimentLocationsSection } from "./experiment-locations-section";

/* --------------------------------- Mocks -------------------------------- */

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<"button">) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="dialog" data-open={open} onClick={() => onOpenChange?.(false)}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
}));

vi.mock("../../experiment-settings/experiment-location-management-card", () => ({
  ExperimentLocationManagement: (props: Record<string, unknown>) => (
    <div data-testid="experiment-location-management" {...props} />
  ),
}));

vi.mock("../../map", () => ({
  Map: () => <div data-testid="map" />,
}));

/* ------------------------------- Test Data ------------------------------- */

const createLocation = (id: string, name: string, lat: number, lng: number): Location => ({
  id,
  name,
  latitude: lat,
  longitude: lng,
  country: "USA",
  region: "NY",
  municipality: "NYC",
  postalCode: "10001",
  addressLabel: "123 Main St",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
});

const mockLocations = {
  one: [createLocation("loc-1", "Location 1", 40.7128, -74.006)],
  two: [
    createLocation("loc-1", "Location 1", 40.7128, -74.006),
    createLocation("loc-2", "Location 2", 34.0522, -118.2437),
  ],
  three: [
    createLocation("loc-1", "Location 1", 40.7128, -74.006),
    createLocation("loc-2", "Location 2", 34.0522, -118.2437),
    createLocation("loc-3", "Location 3", 41.8781, -87.6298),
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

    const dialog = screen.getByTestId("dialog");
    expect(dialog).toHaveAttribute("data-open", "true");
  });

  it("opens dialog when map is clicked", async () => {
    const user = userEvent.setup();
    render(<ExperimentLocationsSection experimentId="exp-123" locations={mockLocations.one} />);

    const mapOverlay = screen.getByTestId("map").parentElement?.querySelector("div");
    if (mapOverlay) {
      await user.click(mapOverlay);
    }

    const dialog = screen.getByTestId("dialog");
    expect(dialog).toHaveAttribute("data-open", "true");
  });
});
