import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateExperimentBody } from "@repo/api";
import type { LocationPoint } from "@repo/ui/components/map";

import { NewExperimentLocationsCard } from "./new-experiment-locations-card";

globalThis.React = React;

/* --------------------------------- Mocks -------------------------------- */

// Mock form hook
const mockWatch = vi.fn();
const mockSetValue = vi.fn();

const mockForm = {
  watch: mockWatch,
  setValue: mockSetValue,
  trigger: vi.fn(),
  getValues: vi.fn(),
  control: {},
  formState: { errors: {} },
} as unknown as UseFormReturn<CreateExperimentBody>;

// Hoisted mock functions
const mockUseLocationGeocode = vi.hoisted(() => vi.fn());
const mockUseLocationSearch = vi.hoisted(() => vi.fn());
const mockUseDebounce = vi.hoisted(() => vi.fn());

// Mock hooks using hoisted functions
vi.mock("../../hooks/locations/useLocationGeocode", () => ({
  useLocationGeocode: mockUseLocationGeocode,
}));

vi.mock("../../hooks/locations/useLocationSearch", () => ({
  useLocationSearch: mockUseLocationSearch,
}));

vi.mock("../../hooks/useDebounce", () => ({
  useDebounce: mockUseDebounce,
}));

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "newExperiment.addLocationsTitle": "Add Locations",
        "newExperiment.addLocationsDescription": "Select locations for your experiment",
        "newExperiment.locationsListTitle": "Selected Locations",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-title">{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-description">{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

// Mock Map component
interface MockMapProps {
  locations: LocationPoint[];
  onLocationsChange?: (locations: LocationPoint[]) => void;
  onLocationAdd?: (lat: number, lng: number) => Promise<LocationPoint | void>;
  selectionMode: boolean;
  onSearch?: (query: string) => void;
  searchResults?: unknown[];
  searchLoading?: boolean;
  center: [number, number];
  zoom: number;
  height: string;
  showSidebar: boolean;
  showLocationSearch: boolean;
  showDistances: boolean;
  sidebarTitle: string;
  sidebarCollapsed: boolean;
  useClustering: boolean;
  showZoomControl: boolean;
  showScale: boolean;
  className: string;
}

let lastMapProps: MockMapProps | null = null;

vi.mock("../map", () => ({
  Map: vi.fn((props: MockMapProps) => {
    lastMapProps = props;
    return (
      <div data-testid="map-component">
        <div data-testid="map-locations">{JSON.stringify(props.locations)}</div>
        <div data-testid="map-selection-mode">{String(props.selectionMode)}</div>
        <div data-testid="map-center">{JSON.stringify(props.center)}</div>
        <div data-testid="map-zoom">{props.zoom}</div>
        <div data-testid="map-height">{props.height}</div>
        <div data-testid="map-show-sidebar">{String(props.showSidebar)}</div>
        <div data-testid="map-sidebar-title">{props.sidebarTitle}</div>
        <button data-testid="mock-trigger-search" onClick={() => props.onSearch?.("test search")}>
          Trigger Search
        </button>
        <button
          data-testid="mock-add-location"
          onClick={() => props.onLocationAdd?.(52.52, 13.405)}
        >
          Add Location
        </button>
        <button
          data-testid="mock-change-locations"
          onClick={() => {
            const newLocations: LocationPoint[] = [
              {
                id: "new-1",
                name: "Test Location",
                latitude: 52.52,
                longitude: 13.405,
              },
            ];
            props.onLocationsChange?.(newLocations);
          }}
        >
          Change Locations
        </button>
      </div>
    );
  }),
}));

/* ------------------------------- Test Data ------------------------------- */

const mockLocations: LocationPoint[] = [
  {
    id: "1",
    name: "Berlin Office",
    latitude: 52.52,
    longitude: 13.405,
    country: "Germany",
    region: "Berlin",
    municipality: "Berlin",
  },
];

const mockSearchResults = [
  {
    label: "Amsterdam, Netherlands",
    latitude: 52.3676,
    longitude: 4.9041,
    country: "Netherlands",
    region: "North Holland",
    municipality: "Amsterdam",
  },
];

const mockGeocodeResults = [
  {
    label: "Berlin, Germany",
    latitude: 52.52,
    longitude: 13.405,
    country: "Germany",
    region: "Berlin",
    municipality: "Berlin",
    postalCode: "10115",
  },
];

/* --------------------------------- Tests -------------------------------- */

describe("NewExperimentLocationsCard", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    lastMapProps = null;

    // Default mock implementations
    mockWatch.mockImplementation((field: string) => {
      if (field === "locations") return [];
      return undefined;
    });

    mockUseLocationGeocode.mockReturnValue({
      data: null,
      isLoading: false,
    });

    mockUseLocationSearch.mockReturnValue({
      data: { body: [] },
      isLoading: false,
    });

    mockUseDebounce.mockReturnValue(["", false]);
  });

  it("renders card with correct title and description", () => {
    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(screen.getByText("Add Locations")).toBeInTheDocument();
    expect(screen.getByText("Select locations for your experiment")).toBeInTheDocument();
  });

  it("renders Map component with correct props", () => {
    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(screen.getByTestId("map-component")).toBeInTheDocument();
    expect(screen.getByTestId("map-selection-mode")).toHaveTextContent("true");
    expect(screen.getByTestId("map-center")).toHaveTextContent("[52.3676,4.9041]");
    expect(screen.getByTestId("map-zoom")).toHaveTextContent("10");
    expect(screen.getByTestId("map-height")).toHaveTextContent("400px");
    expect(screen.getByTestId("map-show-sidebar")).toHaveTextContent("true");
    expect(screen.getByTestId("map-sidebar-title")).toHaveTextContent("Selected Locations");
  });

  it("displays existing locations from form", () => {
    mockWatch.mockImplementation((field: string) => {
      if (field === "locations") return mockLocations;
      return undefined;
    });

    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(screen.getByTestId("map-locations")).toHaveTextContent(JSON.stringify(mockLocations));
  });

  it("handles search query changes", async () => {
    mockUseDebounce.mockReturnValue(["test search", false]);
    mockUseLocationSearch.mockReturnValue({
      data: { body: mockSearchResults },
      isLoading: false,
    });

    render(<NewExperimentLocationsCard form={mockForm} />);

    await user.click(screen.getByTestId("mock-trigger-search"));

    expect(lastMapProps?.onSearch).toBeDefined();
  });

  it("passes search results to Map component", () => {
    mockUseLocationSearch.mockReturnValue({
      data: { body: mockSearchResults },
      isLoading: false,
    });

    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(lastMapProps?.searchResults).toEqual(mockSearchResults);
  });

  it("passes search loading state to Map component", () => {
    mockUseLocationSearch.mockReturnValue({
      data: { body: [] },
      isLoading: true,
    });

    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(lastMapProps?.searchLoading).toBe(true);
  });

  it("calls form setValue when locations change", async () => {
    render(<NewExperimentLocationsCard form={mockForm} />);

    await user.click(screen.getByTestId("mock-change-locations"));

    expect(mockSetValue).toHaveBeenCalledWith("locations", [
      {
        id: "new-1",
        name: "Test Location",
        latitude: 52.52,
        longitude: 13.405,
        country: undefined,
        region: undefined,
        municipality: undefined,
        postalCode: undefined,
        addressLabel: undefined,
      },
    ]);
  });

  it("handles location addition with geocoding", async () => {
    // First, trigger location add without geocode data
    render(<NewExperimentLocationsCard form={mockForm} />);

    await user.click(screen.getByTestId("mock-add-location"));

    expect(lastMapProps?.onLocationAdd).toBeDefined();
  });

  it("handles geocoded location data", async () => {
    // Mock existing locations
    mockWatch.mockImplementation((field: string) => {
      if (field === "locations") return [];
      return undefined;
    });

    // Initially mock geocoding with no data
    mockUseLocationGeocode.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<NewExperimentLocationsCard form={mockForm} />);

    // Clear previous calls
    mockSetValue.mockClear();

    // Now mock geocoding response for when pendingLocation is set
    mockUseLocationGeocode.mockReturnValue({
      data: { body: mockGeocodeResults },
      isLoading: false,
    });

    // Trigger location addition which sets pendingLocation and triggers geocoding effect
    await user.click(screen.getByTestId("mock-add-location"));

    // Wait for the geocoding effect to process and call setValue
    await waitFor(() => {
      expect(mockSetValue).toHaveBeenCalledWith(
        "locations",
        expect.arrayContaining([
          expect.objectContaining({
            name: "Berlin, Germany",
            latitude: 52.52,
            longitude: 13.405,
            country: "Germany",
            region: "Berlin",
            municipality: "Berlin",
            postalCode: "10115",
          }),
        ]),
      );
    });
  });

  it("uses debounced search query", () => {
    const debouncedQuery = "debounced test";
    mockUseDebounce.mockReturnValue([debouncedQuery, false]);

    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(mockUseLocationSearch).toHaveBeenCalledWith(
      debouncedQuery,
      10,
      debouncedQuery.length >= 3,
    );
  });

  it("disables search when query is too short", () => {
    const shortQuery = "ab";
    mockUseDebounce.mockReturnValue([shortQuery, false]);

    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(mockUseLocationSearch).toHaveBeenCalledWith(
      shortQuery,
      10,
      false, // Should be disabled for short queries
    );
  });

  it("handles empty search results", () => {
    mockUseLocationSearch.mockReturnValue({
      data: { body: [] },
      isLoading: false,
    });

    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(lastMapProps?.searchResults).toEqual([]);
  });

  it("handles missing search data", () => {
    mockUseLocationSearch.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(lastMapProps?.searchResults).toEqual([]);
  });

  it("applies correct styling to card", () => {
    render(<NewExperimentLocationsCard form={mockForm} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveClass("min-w-0", "flex-1");

    const cardContent = screen.getByTestId("card-content");
    expect(cardContent).toHaveClass("space-y-4");
  });

  it("passes all required props to Map component", () => {
    render(<NewExperimentLocationsCard form={mockForm} />);

    expect(lastMapProps).toMatchObject({
      selectionMode: true,
      center: [52.3676, 4.9041],
      zoom: 10,
      height: "400px",
      showSidebar: true,
      showLocationSearch: true,
      showDistances: false,
      sidebarCollapsed: false,
      useClustering: true,
      showZoomControl: true,
      showScale: true,
      className: "rounded-lg border",
    });
  });
});
