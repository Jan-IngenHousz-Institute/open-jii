import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentLocationsDisplay } from "./experiment-locations-display";

// Define the type locally for testing
type LocationList = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  municipality?: string;
  postalCode?: string;
  addressLabel?: string;
  createdAt: string;
  updatedAt: string;
}[];

globalThis.React = React;

/* --------------------------------- Mocks -------------------------------- */

interface MockMapProps {
  locations: unknown[];
  center: [number, number];
  zoom: number;
  selectionMode: boolean;
  height: string;
  showSidebar: boolean;
  sidebarTitle: string;
}

vi.mock("next/dynamic", () => ({
  default: () =>
    vi.fn((props: MockMapProps) => (
      <div data-testid="map-component">
        <div data-testid="map-locations">{JSON.stringify(props.locations)}</div>
        <div data-testid="map-center">{JSON.stringify(props.center)}</div>
        <div data-testid="map-zoom">{props.zoom}</div>
        <div data-testid="map-selection-mode">{String(props.selectionMode)}</div>
        <div data-testid="map-height">{props.height}</div>
        <div data-testid="map-show-sidebar">{String(props.showSidebar)}</div>
        <div data-testid="map-sidebar-title">{props.sidebarTitle}</div>
      </div>
    )),
}));

/* ------------------------------- Test Data ------------------------------- */

const mockLocations: LocationList = [
  {
    id: "loc-1",
    name: "Central Park",
    latitude: 40.7829,
    longitude: -73.9654,
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z",
  },
  {
    id: "loc-2",
    name: "Times Square",
    latitude: 40.758,
    longitude: -73.9855,
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z",
  },
  {
    id: "loc-3",
    name: "Brooklyn Bridge",
    latitude: 40.7061,
    longitude: -73.9969,
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z",
  },
];

const singleLocation: LocationList = [
  {
    id: "loc-1",
    name: "Central Park",
    latitude: 40.7829,
    longitude: -73.9654,
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z",
  },
];

/* --------------------------------- Tests -------------------------------- */

describe("ExperimentLocationsDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should render loading skeleton when isLoading is true", () => {
      render(<ExperimentLocationsDisplay locations={[]} isLoading={true} />);

      expect(screen.getByText("details.locations.locationsTitle")).toBeInTheDocument();
      expect(document.querySelector(".lucide-map-pin")).toBeInTheDocument();

      // Check for loading skeleton
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
      expect(document.querySelector(".h-4.w-3\\/4.rounded.bg-gray-200")).toBeInTheDocument();
      expect(document.querySelector(".h-64.rounded.bg-gray-200")).toBeInTheDocument();
    });

    it("should not render map component when loading", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={true} />);

      expect(screen.queryByTestId("map-component")).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should render empty state when locations array is empty", () => {
      render(<ExperimentLocationsDisplay locations={[]} isLoading={false} />);

      expect(screen.getByText("details.locations.locationsTitle")).toBeInTheDocument();

      // Check for empty state content
      expect(screen.getByText("details.locations.noLocations")).toBeInTheDocument();
      expect(screen.getByText("details.locations.noLocationsDescription")).toBeInTheDocument();

      // Should have map pin icon in both header and empty state
      const mapIcons = document.querySelectorAll(".lucide-map-pin");
      expect(mapIcons).toHaveLength(2);

      // Should not render map component
      expect(screen.queryByTestId("map-component")).not.toBeInTheDocument();
    });

    it("should apply correct classes to empty state elements", () => {
      render(<ExperimentLocationsDisplay locations={[]} isLoading={false} />);

      const emptyIcon = document.querySelector(".mx-auto.h-12.w-12.text-gray-400");
      expect(emptyIcon).toBeInTheDocument();

      const emptyTitle = document.querySelector(".mt-2.text-sm.font-medium.text-gray-900");
      expect(emptyTitle).toBeInTheDocument();

      const emptyDescription = document.querySelector(".mt-1.text-sm.text-gray-500");
      expect(emptyDescription).toBeInTheDocument();
    });
  });

  describe("Normal Rendering with Locations", () => {
    it("should render locations with map when locations are provided", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={false} />);

      expect(screen.getAllByText("details.locations.locationsTitle")).toHaveLength(2);
      expect(screen.getByText("experiments.locationsCount")).toBeInTheDocument();

      // Should render map component
      expect(screen.getByTestId("map-component")).toBeInTheDocument();
    });

    it("should pass correct props to Map component with multiple locations", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={false} />);

      // Verify map locations
      const mapLocations = JSON.parse(screen.getByTestId("map-locations").textContent) as unknown[];
      expect(mapLocations).toHaveLength(3);
      expect(mapLocations[0]).toEqual({
        id: "loc-1",
        name: "Central Park",
        latitude: 40.7829,
        longitude: -73.9654,
      });

      // Verify center calculation (average of all locations)
      const center = JSON.parse(screen.getByTestId("map-center").textContent) as number[];
      const expectedCenterLat = (40.7829 + 40.758 + 40.7061) / 3;
      const expectedCenterLng = (-73.9654 + -73.9855 + -73.9969) / 3;
      expect(center[0]).toBeCloseTo(expectedCenterLat, 4);
      expect(center[1]).toBeCloseTo(expectedCenterLng, 4);

      // Verify other map props
      expect(screen.getByTestId("map-zoom")).toHaveTextContent("8");
      expect(screen.getByTestId("map-selection-mode")).toHaveTextContent("false");
      expect(screen.getByTestId("map-height")).toHaveTextContent("400px");
      expect(screen.getByTestId("map-show-sidebar")).toHaveTextContent("true");
      expect(screen.getByTestId("map-sidebar-title")).toHaveTextContent(
        "details.locations.locationsTitle",
      );
    });

    it("should use zoom level 12 for single location", () => {
      render(<ExperimentLocationsDisplay locations={singleLocation} isLoading={false} />);

      expect(screen.getByTestId("map-zoom")).toHaveTextContent("12");
    });

    it("should use zoom level 8 for multiple locations", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={false} />);

      expect(screen.getByTestId("map-zoom")).toHaveTextContent("8");
    });

    it("should display correct location count in header", () => {
      render(<ExperimentLocationsDisplay locations={singleLocation} isLoading={false} />);

      expect(screen.getByText("experiments.locationsCount")).toBeInTheDocument();
    });

    it("should apply correct CSS classes to map container", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={false} />);

      // CardContent renders with space-y-4 class
      const cardContent = document.querySelector(".space-y-4");
      expect(cardContent).toBeInTheDocument();

      const mapContainer = document.querySelector(".overflow-hidden.rounded-lg.border");
      expect(mapContainer).toBeInTheDocument();
    });
  });

  describe("Header Structure", () => {
    it("should render header with correct structure and classes", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={false} />);

      const headerContent = document.querySelector(".flex.items-start.justify-between");
      expect(headerContent).toBeInTheDocument();

      const titleSection = headerContent?.querySelector("div");
      expect(titleSection).toBeInTheDocument();

      // CardTitle contains the title text
      const titleElement = screen.getAllByText("details.locations.locationsTitle")[0];
      expect(titleElement).toBeInTheDocument();

      const locationCount = document.querySelector(".text-muted-foreground.mt-1.text-sm");
      expect(locationCount).toBeInTheDocument();
    });

    it("should always render map pin icon in header", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={false} />);

      // The title text and icon are siblings inside CardTitle
      const titleElement = screen.getAllByText("details.locations.locationsTitle")[0];
      const headerIcon = titleElement.closest("div")?.querySelector(".lucide-map-pin");
      expect(headerIcon).toBeInTheDocument();
      expect(headerIcon).toHaveClass("h-5", "w-5");
    });
  });

  describe("Map Integration", () => {
    it("should pass all required Map component props", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={false} />);

      const mapComponent = screen.getByTestId("map-component");
      expect(mapComponent).toBeInTheDocument();

      // Verify all expected data attributes are present
      expect(screen.getByTestId("map-locations")).toBeInTheDocument();
      expect(screen.getByTestId("map-center")).toBeInTheDocument();
      expect(screen.getByTestId("map-zoom")).toBeInTheDocument();
      expect(screen.getByTestId("map-selection-mode")).toBeInTheDocument();
      expect(screen.getByTestId("map-height")).toBeInTheDocument();
      expect(screen.getByTestId("map-show-sidebar")).toBeInTheDocument();
      expect(screen.getByTestId("map-sidebar-title")).toBeInTheDocument();
    });

    it("should transform API locations to LocationPoint format correctly", () => {
      const apiLocation = {
        id: "test-id",
        name: "Test Location",
        latitude: 12.345,
        longitude: 67.89,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      };

      render(<ExperimentLocationsDisplay locations={[apiLocation]} isLoading={false} />);

      const mapLocations = JSON.parse(screen.getByTestId("map-locations").textContent) as unknown[];
      expect(mapLocations[0]).toEqual({
        id: "test-id",
        name: "Test Location",
        latitude: 12.345,
        longitude: 67.89,
      });
    });
  });

  describe("Props Validation", () => {
    it("should handle undefined isLoading prop (defaults to false)", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} />);

      // Should render normal state, not loading
      expect(screen.getByTestId("map-component")).toBeInTheDocument();
      expect(screen.queryByText("animate-pulse")).not.toBeInTheDocument();
    });

    it("should handle empty locations with isLoading false", () => {
      render(<ExperimentLocationsDisplay locations={[]} isLoading={false} />);

      expect(screen.getByText("details.locations.noLocations")).toBeInTheDocument();
      expect(screen.queryByTestId("map-component")).not.toBeInTheDocument();
    });

    it("should handle empty locations with isLoading true", () => {
      render(<ExperimentLocationsDisplay locations={[]} isLoading={true} />);

      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
      expect(screen.queryByText("details.locations.noLocations")).not.toBeInTheDocument();
      expect(screen.queryByTestId("map-component")).not.toBeInTheDocument();
    });
  });

  describe("Translation Integration", () => {
    it("should use translation keys for all text content", () => {
      render(<ExperimentLocationsDisplay locations={mockLocations} isLoading={false} />);

      expect(screen.getAllByText("details.locations.locationsTitle")).toHaveLength(2);
      expect(screen.getByText("experiments.locationsCount")).toBeInTheDocument();
    });

    it("should use translation keys in empty state", () => {
      render(<ExperimentLocationsDisplay locations={[]} isLoading={false} />);

      expect(screen.getByText("details.locations.noLocations")).toBeInTheDocument();
      expect(screen.getByText("details.locations.noLocationsDescription")).toBeInTheDocument();
    });
  });
});
