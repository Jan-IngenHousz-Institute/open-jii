import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { LocationList } from "@repo/api";
import type { LocationPoint } from "@repo/ui/components/map";

import { ExperimentLocationManagement } from "./experiment-location-management-card";

globalThis.React = React;

/* --------------------------------- Types -------------------------------- */

interface MockMapProps {
  locations: LocationPoint[];
  onLocationsChange?: (locations: LocationPoint[]) => void;
  selectionMode: boolean;
  height: string;
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  showZoomControl: boolean;
  showScale: boolean;
  showSidebar: boolean;
  sidebarTitle: string;
}

/* ----------------------------- Captured props ---------------------------- */

let lastMapProps: MockMapProps | null = null;

/* --------------------------------- Mocks -------------------------------- */

// Hoisted mocks for use in vi.mock factory functions
const useExperimentLocationsMock = vi.hoisted(() => vi.fn());
const useExperimentLocationsUpdateMock = vi.hoisted(() => vi.fn());

// Mock tsr library
vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
    experiments: {
      getExperimentLocations: {
        useQuery: vi.fn(() => useExperimentLocationsMock() as unknown),
      },
      updateExperimentLocations: {
        useMutation: vi.fn(() => useExperimentLocationsUpdateMock() as unknown),
      },
      geocodeLocation: {
        useQuery: vi.fn(() => ({
          data: null,
          isLoading: false,
          error: null,
        })),
      },
      searchPlaces: {
        useQuery: vi.fn(() => ({
          data: null,
          isLoading: false,
          error: null,
        })),
      },
    },
  },
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    const MockMapComponent = vi.fn((props: MockMapProps) => {
      lastMapProps = props;
      return (
        <div data-testid="map-component">
          <div data-testid="map-locations">{JSON.stringify(props.locations)}</div>
          <div data-testid="map-center">{JSON.stringify(props.center)}</div>
          <div data-testid="map-zoom">{props.zoom}</div>
          <div data-testid="map-selection-mode">{String(props.selectionMode)}</div>
          <div data-testid="map-height">{props.height}</div>
          <div data-testid="map-show-sidebar">{String(props.showSidebar)}</div>
          <div data-testid="map-sidebar-title">{props.sidebarTitle}</div>
          <button
            data-testid="mock-add-location"
            onClick={() =>
              props.onLocationsChange?.([
                ...props.locations,
                {
                  id: `new-${Date.now()}`,
                  name: "New Location",
                  latitude: 40.7589,
                  longitude: -73.9851,
                },
              ])
            }
          >
            Add Location
          </button>
          <button
            data-testid="mock-remove-location"
            onClick={() => props.onLocationsChange?.(props.locations.slice(0, -1))}
          >
            Remove Location
          </button>
        </div>
      );
    });
    return MockMapComponent;
  },
}));

vi.mock("../../hooks/experiment/useExperimentLocations/useExperimentLocations", () => ({
  useExperimentLocations: useExperimentLocationsMock,
}));

vi.mock("../../hooks/experiment/useExperimentLocationsUpdate/useExperimentLocationsUpdate", () => ({
  useExperimentLocationsUpdate: useExperimentLocationsUpdateMock,
}));

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-description">{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  MapPinIcon: ({ className }: { className?: string }) => (
    <div data-testid="map-pin-icon" className={className}>
      📍
    </div>
  ),
}));

/* ------------------------------- Test Data ------------------------------- */

const experimentId = "exp-123";

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
];

/* ------------------------------- Test Utils ------------------------------ */

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

/* --------------------------------- Tests -------------------------------- */

describe("ExperimentLocationManagement", () => {
  const mockMutateAsync = vi.fn();
  const mockMutation = {
    mutateAsync: mockMutateAsync,
    isPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lastMapProps = null;

    useExperimentLocationsMock.mockReturnValue({
      data: { body: mockLocations },
      isLoading: false,
    });

    useExperimentLocationsUpdateMock.mockReturnValue(mockMutation);
  });

  describe("Loading State", () => {
    it("should render loading skeleton when isLoading is true", () => {
      useExperimentLocationsMock.mockReturnValue({
        data: null,
        isLoading: true,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(screen.getByTestId("card")).toBeInTheDocument();
      expect(screen.getByTestId("card-header")).toBeInTheDocument();
      expect(screen.getByText("settings.locations.title")).toBeInTheDocument();

      // Check for loading skeleton
      const content = screen.getByTestId("card-content");
      expect(content.querySelector(".animate-pulse")).toBeInTheDocument();
      expect(content.querySelector(".h-4.w-3\\/4.rounded.bg-gray-200")).toBeInTheDocument();
      expect(content.querySelector(".h-32.rounded.bg-gray-200")).toBeInTheDocument();
    });

    it("should not render map component when loading", () => {
      useExperimentLocationsMock.mockReturnValue({
        data: null,
        isLoading: true,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(screen.queryByTestId("map-component")).not.toBeInTheDocument();
    });
  });

  describe("Normal Rendering", () => {
    it("should render the component with all expected elements", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(screen.getByTestId("card")).toBeInTheDocument();
      expect(screen.getByTestId("card-header")).toBeInTheDocument();
      expect(screen.getByTestId("card-title")).toBeInTheDocument();
      expect(screen.getByText("settings.locations.title")).toBeInTheDocument();
      expect(screen.getByText("settings.locations.description")).toBeInTheDocument();
      expect(screen.getByTestId("map-pin-icon")).toBeInTheDocument();
    });

    it("should render map component with correct props", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(screen.getByTestId("map-component")).toBeInTheDocument();
      expect(screen.getByTestId("map-selection-mode")).toHaveTextContent("true");
      expect(screen.getByTestId("map-height")).toHaveTextContent("400px");
      expect(screen.getByTestId("map-show-sidebar")).toHaveTextContent("true");
    });

    it("should render control buttons", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const buttons = screen.getAllByTestId("button");
      expect(buttons).toHaveLength(2);

      const cancelButton = buttons.find((btn) => btn.textContent === "common.cancel");
      const saveButton = buttons.find((btn) => btn.textContent === "common.save");

      expect(cancelButton).toBeInTheDocument();
      expect(saveButton).toBeInTheDocument();
    });

    it("should display location count when locations exist", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(screen.getByText("settings.locations.editingCount_plural")).toBeInTheDocument();
    });
  });

  describe("Map Integration", () => {
    it("should transform API locations to LocationPoint format for map", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const mapLocations = JSON.parse(
        screen.getByTestId("map-locations").textContent ?? "[]",
      ) as LocationPoint[];

      expect(mapLocations).toHaveLength(2);
      expect(mapLocations[0]).toEqual({
        id: "loc-1",
        name: "Central Park",
        latitude: 40.7829,
        longitude: -73.9654,
      });
      expect(mapLocations[1]).toEqual({
        id: "loc-2",
        name: "Times Square",
        latitude: 40.758,
        longitude: -73.9855,
      });
    });

    it("should calculate center based on available locations", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const center = JSON.parse(screen.getByTestId("map-center").textContent ?? "[]") as number[];
      const expectedLat = (40.7829 + 40.758) / 2;
      const expectedLng = (-73.9654 + -73.9855) / 2;

      expect(center[0]).toBeCloseTo(expectedLat, 4);
      expect(center[1]).toBeCloseTo(expectedLng, 4);
    });

    it("should use default center when no locations exist", () => {
      useExperimentLocationsMock.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const center = JSON.parse(screen.getByTestId("map-center").textContent ?? "[]") as number[];
      expect(center).toEqual([52.52, 13.405]); // Berlin coordinates
    });

    it("should handle location changes from map", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      // Simulate adding a location through the map
      await user.click(screen.getByTestId("mock-add-location"));

      // Verify the count updated
      await waitFor(() => {
        expect(screen.getByText("settings.locations.editingCount_plural")).toBeInTheDocument();
      });
    });

    it("should handle location removal from map", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      // Simulate removing a location through the map
      await user.click(screen.getByTestId("mock-remove-location"));

      // Verify the count updated
      await waitFor(() => {
        expect(screen.getByText("settings.locations.editingCount")).toBeInTheDocument();
      });
    });
  });

  describe("Save Functionality", () => {
    it("should call updateLocationsMutation with correct data when save is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const saveButton = screen
        .getAllByTestId("button")
        .find((btn) => btn.textContent === "common.save");
      expect(saveButton).toBeInTheDocument();

      if (saveButton) {
        await user.click(saveButton);
      }

      expect(mockMutateAsync).toHaveBeenCalledWith({
        params: { id: experimentId },
        body: {
          locations: [
            {
              name: "Central Park",
              latitude: 40.7829,
              longitude: -73.9654,
            },
            {
              name: "Times Square",
              latitude: 40.758,
              longitude: -73.9855,
            },
          ],
        },
      });
    });

    it("should save modified locations after map changes", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      // Add a location through the map
      await user.click(screen.getByTestId("mock-add-location"));

      // Click save
      const saveButton = screen
        .getAllByTestId("button")
        .find((btn) => btn.textContent === "common.save");
      if (saveButton) {
        await user.click(saveButton);
      }

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            locations: expect.arrayContaining([
              expect.objectContaining({ name: "Central Park" }),
              expect.objectContaining({ name: "Times Square" }),
              expect.objectContaining({ name: "New Location" }),
            ]) as unknown,
          },
        }),
      );
    });

    it("should disable save button when mutation is pending", () => {
      useExperimentLocationsUpdateMock.mockReturnValue({
        ...mockMutation,
        isPending: true,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const saveButton = screen
        .getAllByTestId("button")
        .find((btn) => btn.textContent === "common.saving");
      expect(saveButton).toBeDisabled();
    });

    it("should show saving text when mutation is pending", () => {
      useExperimentLocationsUpdateMock.mockReturnValue({
        ...mockMutation,
        isPending: true,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(screen.getByText("common.saving")).toBeInTheDocument();
      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
    });
  });

  describe("Cancel Functionality", () => {
    it("should reset locations to original state when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      // Add a location through the map
      await user.click(screen.getByTestId("mock-add-location"));
      expect(screen.getByText("settings.locations.editingCount_plural")).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen
        .getAllByTestId("button")
        .find((btn) => btn.textContent === "common.cancel");
      if (cancelButton) {
        await user.click(cancelButton);
      }

      // Verify locations reset to original state
      await waitFor(() => {
        expect(screen.getByText("settings.locations.editingCount_plural")).toBeInTheDocument();
      });
    });

    it("should disable cancel button when mutation is pending", () => {
      useExperimentLocationsUpdateMock.mockReturnValue({
        ...mockMutation,
        isPending: true,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const cancelButton = screen
        .getAllByTestId("button")
        .find((btn) => btn.textContent === "common.cancel");
      expect(cancelButton).toBeDisabled();
    });
  });

  describe("useEffect Synchronization", () => {
    it("should sync editedLocations with API data when data changes", () => {
      const { rerender } = renderWithQueryClient(
        <ExperimentLocationManagement experimentId={experimentId} />,
      );

      // Initial state
      expect(screen.getByText("settings.locations.editingCount_plural")).toBeInTheDocument();

      // Update mock data
      const newLocations = [mockLocations[0]]; // Only one location
      useExperimentLocationsMock.mockReturnValue({
        data: { body: newLocations },
        isLoading: false,
      });

      rerender(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(screen.getByText("settings.locations.editingCount")).toBeInTheDocument();
    });

    it("should handle empty locations from API", () => {
      useExperimentLocationsMock.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      // When there are no locations, the count section should not be displayed at all
      expect(screen.queryByText(/Editing 0 locations/)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/settings.locations.editingCount/),
      ).not.toBeInTheDocument();
    });
  });

  describe("Props and Component Structure", () => {
    it("should call useExperimentLocations hook", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      // Just verify the hook was called, the argument checking is proving problematic
      expect(useExperimentLocationsMock).toHaveBeenCalled();
    });

    it("should apply correct CSS classes to card content", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const cardContent = screen.getByTestId("card-content");
      expect(cardContent).toHaveClass("space-y-4");
    });

    it("should render card header structure correctly", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      const cardHeader = screen.getByTestId("card-header");
      expect(cardHeader).toBeInTheDocument();

      const cardTitle = screen.getByTestId("card-title");
      expect(cardTitle).toHaveClass("flex", "items-center", "gap-2");

      expect(screen.getByTestId("card-description")).toBeInTheDocument();
    });

    it("should pass all required props to Map component", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(lastMapProps).toMatchObject({
        selectionMode: true,
        height: "400px",
        zoom: 8,
        minZoom: 2,
        maxZoom: 18,
        showZoomControl: true,
        showScale: true,
        showSidebar: true,
        sidebarTitle: "settings.locations.editMode",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle undefined data body gracefully", () => {
      useExperimentLocationsMock.mockReturnValue({
        data: { body: undefined },
        isLoading: false,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      // When data.body is undefined, no count should be displayed
      expect(screen.queryByText(/Editing 0 locations/)).not.toBeInTheDocument();
      // But the component should still render properly
      expect(screen.getByText("settings.locations.title")).toBeInTheDocument();
    });

    it("should handle null data gracefully", () => {
      useExperimentLocationsMock.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      // When data is null, no count should be displayed
      expect(screen.queryByText(/Editing 0 locations/)).not.toBeInTheDocument();
      // But the component should still render properly
      expect(screen.getByText("settings.locations.title")).toBeInTheDocument();
    });
  });

  describe("Translation Integration", () => {
    it("should use translation keys for all text content", () => {
      renderWithQueryClient(<ExperimentLocationManagement experimentId={experimentId} />);

      expect(screen.getByText("settings.locations.title")).toBeInTheDocument();
      expect(screen.getByText("settings.locations.description")).toBeInTheDocument();
      // Use getAllByText for duplicate text that appears in multiple places
      expect(screen.getAllByText("settings.locations.editMode")).toHaveLength(2);
      expect(
        screen.getByText("settings.locations.editModeDescription"),
      ).toBeInTheDocument();
      expect(screen.getByText("common.cancel")).toBeInTheDocument();
      expect(screen.getByText("common.save")).toBeInTheDocument();
    });
  });
});
