import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { Map, LocationPoint, MapProps } from "./map";

// Mock Leaflet and related dependencies - must be hoisted
const mockLeaflet = vi.hoisted(() => ({
  default: {
    divIcon: vi.fn(() => ({ _leaflet_id: 1 })),
    atan2: Math.atan2,
  },
}));

vi.mock("leaflet", () => mockLeaflet);
vi.mock("leaflet/dist/leaflet.css", () => ({}));

// Mock react-leaflet components
// Provide a shared mockMap object so tests can assert calls to fitBounds/setView
const mockMap = {
  setView: vi.fn(),
  getZoom: vi.fn(() => 10),
  fitBounds: vi.fn(),
  getMaxZoom: vi.fn(() => 18),
};

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, zoomControl, ...props }: any) => (
    <div data-testid="map-container" data-zoom-control={zoomControl} {...props}>
      {children}
    </div>
  ),
  TileLayer: (props: any) => <div data-testid="tile-layer" {...props} />,
  Marker: ({ children, eventHandlers, ...props }: any) => (
    <div
      data-testid="marker"
      data-position={JSON.stringify(props.position)}
      data-draggable={props.draggable}
      onClick={() => eventHandlers?.click?.()}
      {...props}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  ZoomControl: (props: any) => <div data-testid="zoom-control" {...props} />,
  ScaleControl: (props: any) => <div data-testid="scale-control" {...props} />,
  useMapEvents: vi.fn((eventHandlers: any) => {
    // Store the click handler for testing
    (globalThis as any).__mapClickHandler = eventHandlers.click;
    return null;
  }),
  useMap: vi.fn(() => mockMap),
}));

// Mock react-leaflet-cluster
vi.mock("react-leaflet-cluster", () => ({
  default: ({ children, iconCreateFunction }: any) => (
    <div data-testid="marker-cluster-group" data-icon-create-function={!!iconCreateFunction}>
      {children}
    </div>
  ),
}));

// Mock the child components
vi.mock("./location-search", () => ({
  LocationSearch: ({
    onLocationSelect,
    onSearch,
    searchResults,
    searchLoading,
    placeholder,
    className,
    disabled,
  }: any) => (
    <div
      data-testid="location-search"
      data-placeholder={placeholder}
      data-class-name={className}
      data-disabled={disabled}
      data-search-loading={searchLoading}
      data-search-results-count={searchResults?.length || 0}
    >
      <input
        data-testid="search-input"
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onSearch?.(e.target.value)}
      />
      <button
        data-testid="mock-select-location"
        onClick={() =>
          onLocationSelect?.({
            label: "Test Location",
            latitude: 40.7128,
            longitude: -74.006,
            country: "US",
            region: "NY",
            municipality: "New York",
            postalCode: "10001",
          })
        }
      >
        Select Location
      </button>
    </div>
  ),
}));

vi.mock("./location-sidebar", () => ({
  LocationSidebar: ({
    locations,
    selectedLocation,
    onLocationSelect,
    onLocationNavigate,
    onLocationRemove,
    showDistances,
    selectionMode,
    disabled,
  }: any) => (
    <div
      data-testid="location-sidebar"
      data-locations-count={locations?.length || 0}
      data-selected-location-id={selectedLocation?.id || ""}
      data-show-distances={showDistances}
      data-selection-mode={selectionMode}
    >
      {locations?.map((location: any, index: number) => (
        <div key={location.id || index} data-testid={`sidebar-location-${location.id || index}`}>
          <span>{location.name}</span>
          <button
            data-testid={`select-location-${location.id || index}`}
            onClick={() => onLocationSelect?.(location)}
          >
            Select
          </button>
          <button
            data-testid={`navigate-location-${location.id || index}`}
            onClick={() => onLocationNavigate?.(location)}
          >
            Navigate
          </button>
          {selectionMode && !disabled && (
            <button
              data-testid={`remove-location-${location.id || index}`}
              onClick={() => onLocationRemove?.(location)}
            >
              Remove
            </button>
          )}
          {location.distance !== undefined && (
            <span data-testid={`distance-${location.id || index}`}>
              Distance: {location.distance.toFixed(2)} km
            </span>
          )}
        </div>
      ))}
    </div>
  ),
}));

describe("Map Component", () => {
  const mockLocations: LocationPoint[] = [
    {
      id: "loc-1",
      name: "Central Park",
      latitude: 40.7829,
      longitude: -73.9654,
      country: "US",
      region: "NY",
      municipality: "New York",
    },
    {
      id: "loc-2",
      name: "Times Square",
      latitude: 40.758,
      longitude: -73.9855,
      country: "US",
      region: "NY",
      municipality: "New York",
    },
  ];

  const defaultProps: MapProps = {
    locations: mockLocations,
    center: [40.7128, -74.006],
    zoom: 10,
    height: "400px",
  };

  beforeEach(() => {
    // Reset global mocks
    (globalThis as any).__mapClickHandler = null;
    // Mock window.open
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Basic Rendering", () => {
    it("should render the map container with default props", () => {
      render(<Map />);

      expect(screen.getByTestId("map-container")).toBeInTheDocument();
      expect(screen.getByTestId("tile-layer")).toBeInTheDocument();
    });

    it("should render with custom height and className", () => {
      const { container } = render(<Map height="500px" className="custom-map-class" />);

      const mapWrapper = container.querySelector(".custom-map-class");
      expect(mapWrapper).toBeInTheDocument();

      const mapContainer = mapWrapper?.querySelector('[style*="height: 500px"]');
      expect(mapContainer).toBeInTheDocument();
    });

    it("should render disabled state correctly", () => {
      const { container } = render(<Map disabled />);

      const mapWrapper = container.querySelector(".cursor-not-allowed.opacity-50");
      expect(mapWrapper).toBeInTheDocument();
    });

    it("should render zoom and scale controls when enabled", () => {
      render(<Map showZoomControl showScale />);

      expect(screen.getByTestId("zoom-control")).toBeInTheDocument();
      expect(screen.getByTestId("scale-control")).toBeInTheDocument();
    });

    it("should not render controls when disabled", () => {
      render(<Map showZoomControl={false} showScale={false} />);

      expect(screen.queryByTestId("zoom-control")).not.toBeInTheDocument();
      expect(screen.queryByTestId("scale-control")).not.toBeInTheDocument();
    });
  });

  describe("Location Display", () => {
    it("should render markers for provided locations", () => {
      render(<Map {...defaultProps} />);

      const markers = screen.getAllByTestId("marker");
      expect(markers).toHaveLength(2);

      expect(markers[0]).toHaveAttribute("data-position", "[40.7829,-73.9654]");
      expect(markers[1]).toHaveAttribute("data-position", "[40.758,-73.9855]");
    });

    it("should render popups with location information", () => {
      render(<Map {...defaultProps} />);

      expect(screen.getByText("Central Park")).toBeInTheDocument();
      expect(screen.getByText("Times Square")).toBeInTheDocument();
      expect(screen.getByText("40.782900, -73.965400")).toBeInTheDocument();
      expect(screen.getAllByText("New York, NY, US")).toHaveLength(2);
    });

    it("should render with clustering when enabled", () => {
      render(<Map {...defaultProps} useClustering />);

      expect(screen.getByTestId("marker-cluster-group")).toBeInTheDocument();
    });

    it("should render without clustering when disabled", () => {
      render(<Map {...defaultProps} useClustering={false} />);

      expect(screen.queryByTestId("marker-cluster-group")).not.toBeInTheDocument();
    });

    it("should handle empty locations array", () => {
      render(<Map locations={[]} />);

      expect(screen.queryByTestId("marker")).not.toBeInTheDocument();
    });
  });

  describe("Selection Mode and Interactions", () => {
    it("should enable marker dragging in selection mode", () => {
      render(<Map {...defaultProps} selectionMode />);

      const markers = screen.getAllByTestId("marker");
      markers.forEach((marker) => {
        expect(marker).toHaveAttribute("data-draggable", "true");
      });
    });

    it("should disable marker dragging when not in selection mode", () => {
      render(<Map {...defaultProps} selectionMode={false} />);

      const markers = screen.getAllByTestId("marker");
      markers.forEach((marker) => {
        expect(marker).toHaveAttribute("data-draggable", "false");
      });
    });

    it("should handle map clicks in selection mode", async () => {
      const mockOnLocationsChange = vi.fn();
      render(<Map {...defaultProps} selectionMode onLocationsChange={mockOnLocationsChange} />);

      // Simulate map click through the stored handler
      const mockEvent = { latlng: { lat: 41.0, lng: -74.0 } };
      const clickHandler = (globalThis as any).__mapClickHandler;

      if (clickHandler) {
        await clickHandler(mockEvent);

        await waitFor(() => {
          expect(mockOnLocationsChange).toHaveBeenCalledWith(
            expect.arrayContaining([
              ...mockLocations,
              expect.objectContaining({
                latitude: 41.0,
                longitude: -74.0,
                name: expect.stringContaining("Location"),
              }),
            ]),
          );
        });
      }
    });

    it("should handle map clicks with onLocationAdd callback", async () => {
      const mockOnLocationAdd = vi.fn().mockResolvedValue({
        id: "new-1",
        name: "New Location",
        latitude: 41.0,
        longitude: -74.0,
        address: "123 Main St",
      });
      const mockOnLocationsChange = vi.fn();

      render(
        <Map
          {...defaultProps}
          selectionMode
          onLocationAdd={mockOnLocationAdd}
          onLocationsChange={mockOnLocationsChange}
        />,
      );

      const mockEvent = { latlng: { lat: 41.0, lng: -74.0 } };
      const clickHandler = (globalThis as any).__mapClickHandler;

      if (clickHandler) {
        await clickHandler(mockEvent);

        await waitFor(() => {
          expect(mockOnLocationAdd).toHaveBeenCalledWith(41.0, -74.0);
          expect(mockOnLocationsChange).toHaveBeenCalledWith(
            expect.arrayContaining([
              ...mockLocations,
              expect.objectContaining({
                id: "new-1",
                name: "New Location",
                latitude: 41.0,
                longitude: -74.0,
              }),
            ]),
          );
        });
      }
    });

    it("should not handle map clicks when disabled", async () => {
      const mockOnLocationsChange = vi.fn();
      render(
        <Map {...defaultProps} selectionMode disabled onLocationsChange={mockOnLocationsChange} />,
      );

      const mockEvent = { latlng: { lat: 41.0, lng: -74.0 } };
      const clickHandler = (globalThis as any).__mapClickHandler;

      if (clickHandler) {
        await clickHandler(mockEvent);

        // Should not be called when disabled
        expect(mockOnLocationsChange).not.toHaveBeenCalled();
      }
    });
  });

  describe("Location Search", () => {
    it("should render location search when enabled", () => {
      render(<Map {...defaultProps} showLocationSearch />);

      expect(screen.getByTestId("location-search")).toBeInTheDocument();
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    it("should not render location search by default", () => {
      render(<Map {...defaultProps} />);

      expect(screen.queryByTestId("location-search")).not.toBeInTheDocument();
    });

    it("should handle search input", async () => {
      const mockOnSearch = vi.fn();
      const user = userEvent.setup();

      render(<Map {...defaultProps} showLocationSearch onSearch={mockOnSearch} />);

      const searchInput = screen.getByTestId("search-input");
      await user.type(searchInput, "New York");

      expect(mockOnSearch).toHaveBeenCalledWith("New York");
    });

    it("should pass search results and loading state to LocationSearch", () => {
      const searchResults = [
        { label: "Result 1", latitude: 40.0, longitude: -74.0 },
        { label: "Result 2", latitude: 41.0, longitude: -75.0 },
      ];

      render(
        <Map {...defaultProps} showLocationSearch searchResults={searchResults} searchLoading />,
      );

      const locationSearch = screen.getByTestId("location-search");
      expect(locationSearch).toHaveAttribute("data-search-results-count", "2");
      expect(locationSearch).toHaveAttribute("data-search-loading", "true");
    });

    it("should handle location selection from search", async () => {
      const mockOnLocationsChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Map
          {...defaultProps}
          showLocationSearch
          selectionMode
          onLocationsChange={mockOnLocationsChange}
        />,
      );

      await user.click(screen.getByTestId("mock-select-location"));

      expect(mockOnLocationsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          ...mockLocations,
          expect.objectContaining({
            name: "Test Location",
            latitude: 40.7128,
            longitude: -74.006,
            country: "US",
            region: "NY",
            municipality: "New York",
            postalCode: "10001",
          }),
        ]),
      );
    });
  });

  describe("Sidebar Functionality", () => {
    it("should render sidebar when enabled", () => {
      render(<Map {...defaultProps} showSidebar sidebarTitle="Test Locations" />);

      expect(screen.getByTestId("location-sidebar")).toBeInTheDocument();
      expect(screen.getByText("Test Locations")).toBeInTheDocument();
    });

    it("should not render sidebar by default", () => {
      render(<Map {...defaultProps} />);

      expect(screen.queryByTestId("location-sidebar")).not.toBeInTheDocument();
    });

    it("should pass correct props to sidebar", () => {
      render(
        <Map
          {...defaultProps}
          showSidebar
          showDistances
          selectionMode
          referencePoint={[40.0, -74.0]}
        />,
      );

      const sidebar = screen.getByTestId("location-sidebar");
      expect(sidebar).toHaveAttribute("data-locations-count", "2");
      expect(sidebar).toHaveAttribute("data-show-distances", "true");
      expect(sidebar).toHaveAttribute("data-selection-mode", "true");
    });

    it("should handle sidebar collapse/expand", async () => {
      const user = userEvent.setup();
      render(<Map {...defaultProps} showSidebar />);

      const collapseButton = screen.getByTitle("Collapse sidebar");
      await user.click(collapseButton);

      expect(screen.getByTitle("Expand sidebar")).toBeInTheDocument();
    });

    it("should start collapsed when sidebarCollapsed is true", () => {
      render(<Map {...defaultProps} showSidebar sidebarCollapsed />);

      expect(screen.getByTitle("Expand sidebar")).toBeInTheDocument();
    });
  });

  describe("Location Management from Sidebar", () => {
    it("should handle location selection from sidebar", async () => {
      const user = userEvent.setup();
      render(<Map {...defaultProps} showSidebar />);

      await user.click(screen.getByTestId("select-location-loc-1"));

      // Location should be selected (tested via marker selection state)
      const sidebar = screen.getByTestId("location-sidebar");
      expect(sidebar).toHaveAttribute("data-selected-location-id", "loc-1");
    });

    it("should handle location navigation from sidebar", async () => {
      const user = userEvent.setup();
      const mockWindowOpen = vi.fn();
      vi.stubGlobal("open", mockWindowOpen);

      render(<Map {...defaultProps} showSidebar />);

      await user.click(screen.getByTestId("navigate-location-loc-1"));

      expect(mockWindowOpen).toHaveBeenCalledWith(
        "https://www.google.com/maps/dir/?api=1&destination=40.7829,-73.9654",
        "_blank",
      );
    });

    it("should handle location removal from sidebar", async () => {
      const mockOnLocationsChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Map
          {...defaultProps}
          showSidebar
          selectionMode
          onLocationsChange={mockOnLocationsChange}
        />,
      );

      await user.click(screen.getByTestId("remove-location-loc-1"));

      expect(mockOnLocationsChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: "loc-2" }),
      ]);
    });

    it("should not allow removal when not in selection mode", () => {
      render(<Map {...defaultProps} showSidebar selectionMode={false} />);

      expect(screen.queryByTestId("remove-location-loc-1")).not.toBeInTheDocument();
    });

    it("should not allow removal when disabled", () => {
      render(<Map {...defaultProps} showSidebar selectionMode disabled />);

      expect(screen.queryByTestId("remove-location-loc-1")).not.toBeInTheDocument();
    });
  });

  describe("Distance Calculations", () => {
    it("should calculate and display distances when enabled", () => {
      render(<Map {...defaultProps} showSidebar showDistances referencePoint={[40.0, -74.0]} />);

      expect(screen.getByTestId("distance-loc-1")).toBeInTheDocument();
      expect(screen.getByTestId("distance-loc-2")).toBeInTheDocument();
    });

    it("should not display distances when disabled", () => {
      render(<Map {...defaultProps} showSidebar showDistances={false} />);

      expect(screen.queryByTestId("distance-loc-1")).not.toBeInTheDocument();
      expect(screen.queryByTestId("distance-loc-2")).not.toBeInTheDocument();
    });

    it("should not display distances without reference point", () => {
      render(<Map {...defaultProps} showSidebar showDistances />);

      expect(screen.queryByTestId("distance-loc-1")).not.toBeInTheDocument();
      expect(screen.queryByTestId("distance-loc-2")).not.toBeInTheDocument();
    });
  });

  describe("Marker Selection", () => {
    it("should handle marker click selection", async () => {
      const user = userEvent.setup();
      render(<Map {...defaultProps} showSidebar />);

      const markers = screen.getAllByTestId("marker");
      const marker = markers[0];
      if (marker) {
        await user.click(marker);

        const sidebar = screen.getByTestId("location-sidebar");
        expect(sidebar).toHaveAttribute("data-selected-location-id", "loc-1");
      }
    });

    it("should clear selection when removed location was selected", async () => {
      const mockOnLocationsChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Map
          {...defaultProps}
          showSidebar
          selectionMode
          onLocationsChange={mockOnLocationsChange}
        />,
      );

      // Select a location first
      await user.click(screen.getByTestId("select-location-loc-1"));

      // Then remove it
      await user.click(screen.getByTestId("remove-location-loc-1"));

      expect(mockOnLocationsChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: "loc-2" }),
      ]);

      // Selection should be cleared
      const sidebar = screen.getByTestId("location-sidebar");
      expect(sidebar).toHaveAttribute("data-selected-location-id", "");
    });
  });

  describe("Configuration Props", () => {
    it("should apply custom zoom and center", () => {
      render(<Map center={[51.5074, -0.1278]} zoom={15} minZoom={5} maxZoom={20} />);

      const mapContainer = screen.getByTestId("map-container");
      expect(mapContainer).toHaveAttribute("center", "51.5074,-0.1278");
      expect(mapContainer).toHaveAttribute("zoom", "15");
      expect(mapContainer).toHaveAttribute("minZoom", "5");
      expect(mapContainer).toHaveAttribute("maxZoom", "20");
    });

    it("should disable zoom control correctly", () => {
      render(<Map showZoomControl={false} />);

      const mapContainer = screen.getByTestId("map-container");
      expect(mapContainer).toHaveAttribute("data-zoom-control", "false");
    });

    it("should handle locations without optional fields", () => {
      const minimalLocations: LocationPoint[] = [
        {
          name: "Minimal Location",
          latitude: 40.0,
          longitude: -74.0,
        },
      ];

      render(<Map locations={minimalLocations} />);

      expect(screen.getByText("Minimal Location")).toBeInTheDocument();
      expect(screen.getByText("40.000000, -74.000000")).toBeInTheDocument();
    });

    it("should render location with address", () => {
      const locationWithAddress: LocationPoint[] = [
        {
          id: "addr-1",
          name: "Location with Address",
          latitude: 40.0,
          longitude: -74.0,
          address: "123 Main Street, New York, NY 10001",
        },
      ];

      render(<Map locations={locationWithAddress} />);

      expect(screen.getByText("123 Main Street, New York, NY 10001")).toBeInTheDocument();
    });
  });

  describe("FitBounds behavior", () => {
    beforeEach(() => {
      // Clear mockMap calls
      mockMap.setView.mockClear();
      mockMap.fitBounds.mockClear();
      mockMap.getZoom.mockClear();
      mockMap.getMaxZoom.mockClear();
    });

    it("should call fitBounds once on initial render when multiple locations present", () => {
      const { rerender } = render(<Map {...defaultProps} />);

      // fitBounds should have been called once during initial mount
      expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);

      // Rerender with an additional location - should not call fitBounds again
      const newLoc: LocationPoint = {
        id: "loc-3",
        name: "New Loc",
        latitude: 41.0,
        longitude: -74.0,
      };
      rerender(<Map {...defaultProps} locations={[...mockLocations, newLoc]} />);

      expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
    });

    it("should not call fitBounds when fitBoundsOnMapLoad is false", () => {
      render(<Map {...defaultProps} fitBoundsOnMapLoad={false} />);

      expect(mockMap.fitBounds).not.toHaveBeenCalled();
    });

    it("should set view for a single location with capped zoom", () => {
      const single: LocationPoint[] = [{ id: "only", name: "Only", latitude: 10, longitude: 20 }];

      render(<Map {...defaultProps} locations={single} />);

      // For single location we expect setView to be used
      expect(mockMap.setView).toHaveBeenCalled();
      const [[coords, zoom]] = mockMap.setView.mock.calls as any;
      expect(coords).toEqual([10, 20]);
      // Zoom should be a number and capped (<=12 per implementation)
      expect(typeof zoom).toBe("number");
      expect(zoom).toBeLessThanOrEqual(12);
    });
  });

  describe("Error Handling", () => {
    it("should handle undefined locations gracefully", () => {
      render(<Map locations={undefined} />);

      expect(screen.queryByTestId("marker")).not.toBeInTheDocument();
    });

    it("should handle onLocationAdd rejection gracefully", async () => {
      // Mock console.error to suppress error logs
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockOnLocationAdd = vi.fn().mockRejectedValue(new Error("Geocoding failed"));
      const mockOnLocationsChange = vi.fn();

      render(
        <Map
          {...defaultProps}
          selectionMode
          onLocationAdd={mockOnLocationAdd}
          onLocationsChange={mockOnLocationsChange}
        />,
      );

      const mockEvent = { latlng: { lat: 41.0, lng: -74.0 } };
      const clickHandler = (globalThis as any).__mapClickHandler;

      if (clickHandler) {
        // Call the click handler and wait for async operation to complete
        await clickHandler(mockEvent);

        expect(mockOnLocationAdd).toHaveBeenCalledWith(41.0, -74.0);
        // Should not update locations on error
        expect(mockOnLocationsChange).not.toHaveBeenCalled();
        // Should log the error
        expect(consoleSpy).toHaveBeenCalledWith("Failed to add location:", expect.any(Error));
      }

      consoleSpy.mockRestore();
    });
    it("should handle onLocationAdd returning void", async () => {
      const mockOnLocationAdd = vi.fn().mockResolvedValue(undefined);
      const mockOnLocationsChange = vi.fn();

      render(
        <Map
          {...defaultProps}
          selectionMode
          onLocationAdd={mockOnLocationAdd}
          onLocationsChange={mockOnLocationsChange}
        />,
      );

      const mockEvent = { latlng: { lat: 41.0, lng: -74.0 } };
      const clickHandler = (globalThis as any).__mapClickHandler;

      if (clickHandler) {
        await clickHandler(mockEvent);

        expect(mockOnLocationAdd).toHaveBeenCalledWith(41.0, -74.0);
        // Should not update locations when onLocationAdd returns void
        expect(mockOnLocationsChange).not.toHaveBeenCalled();
      }
    });
  });

  describe("Accessibility", () => {
    it("should provide accessible sidebar toggle buttons", () => {
      render(<Map {...defaultProps} showSidebar />);

      expect(screen.getByTitle("Collapse sidebar")).toBeInTheDocument();
    });

    it("should have proper button roles for location actions", () => {
      render(<Map {...defaultProps} showSidebar selectionMode />);

      // Check that buttons exist and are clickable
      expect(screen.getByTestId("select-location-loc-1")).toBeInTheDocument();
      expect(screen.getByTestId("navigate-location-loc-1")).toBeInTheDocument();
      expect(screen.getByTestId("remove-location-loc-1")).toBeInTheDocument();
    });
  });
});
