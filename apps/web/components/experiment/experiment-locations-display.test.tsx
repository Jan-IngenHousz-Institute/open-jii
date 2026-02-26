import { createLocation } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentLocationsDisplay } from "./experiment-locations-display";

/* --------------------------------- Mocks -------------------------------- */

// Leaflet map cannot render in jsdom (canvas/WebGL) — pragmatic exception.
// The mock exposes received props so we can verify the component passes
// the right data to the map without needing a real map renderer.
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

/* --------------------------------- Tests -------------------------------- */

describe("ExperimentLocationsDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton and hides map when isLoading", () => {
    render(<ExperimentLocationsDisplay locations={[]} isLoading={true} />);

    expect(screen.getByText("details.locations.locationsTitle")).toBeInTheDocument();
    expect(screen.queryByTestId("map-component")).not.toBeInTheDocument();
  });

  it("renders empty state when no locations", () => {
    render(<ExperimentLocationsDisplay locations={[]} isLoading={false} />);

    expect(screen.getByText("details.locations.locationsTitle")).toBeInTheDocument();
    expect(screen.getByText("details.locations.noLocations")).toBeInTheDocument();
    expect(screen.getByText("details.locations.noLocationsDescription")).toBeInTheDocument();
    expect(screen.queryByTestId("map-component")).not.toBeInTheDocument();
  });

  it("renders map with location count when locations exist", () => {
    const locations = [
      createLocation({ name: "Central Park" }),
      createLocation({ name: "Times Square" }),
    ];

    render(<ExperimentLocationsDisplay locations={locations} isLoading={false} />);

    // Title appears in both header and map sidebar
    expect(screen.getAllByText("details.locations.locationsTitle").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByTestId("map-component")).toBeInTheDocument();
  });

  it("passes transformed locations and computed center to Map", () => {
    const locations = [
      createLocation({ id: "loc-a", name: "A", latitude: 40.0, longitude: -74.0 }),
      createLocation({ id: "loc-b", name: "B", latitude: 42.0, longitude: -72.0 }),
    ];

    render(<ExperimentLocationsDisplay locations={locations} isLoading={false} />);

    const mapLocations = JSON.parse(screen.getByTestId("map-locations").textContent) as unknown[];
    expect(mapLocations).toHaveLength(2);
    expect(mapLocations[0]).toMatchObject({ id: "loc-a", name: "A", latitude: 40.0 });

    const center = JSON.parse(screen.getByTestId("map-center").textContent) as number[];
    expect(center[0]).toBeCloseTo(41.0, 4); // avg lat
    expect(center[1]).toBeCloseTo(-73.0, 4); // avg lng
  });

  it("uses zoom 12 for a single location, 8 for multiple", () => {
    const { unmount } = render(
      <ExperimentLocationsDisplay locations={[createLocation()]} isLoading={false} />,
    );
    expect(screen.getByTestId("map-zoom")).toHaveTextContent("12");
    unmount();

    render(
      <ExperimentLocationsDisplay
        locations={[createLocation(), createLocation()]}
        isLoading={false}
      />,
    );
    expect(screen.getByTestId("map-zoom")).toHaveTextContent("8");
  });

  it("defaults isLoading to false when omitted", () => {
    render(<ExperimentLocationsDisplay locations={[createLocation()]} />);

    expect(screen.getByTestId("map-component")).toBeInTheDocument();
  });
});
