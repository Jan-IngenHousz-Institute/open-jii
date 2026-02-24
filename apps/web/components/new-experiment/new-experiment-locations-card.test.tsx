/**
 * NewExperimentLocationsCard — MSW-based test.
 *
 * `useLocationGeocode` (GET /api/v1/locations/geocode) and
 * `useLocationSearch` (GET /api/v1/locations/search) run for real;
 * MSW intercepts the HTTP requests.
 *
 * Legitimately mocked:
 *  - Map component — complex leaflet rendering, tested separately
 *  - useDebounce — timing utility (no HTTP)
 *  - Form — passed as prop, not the system under test
 */
import { createPlace } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import type { UseFormReturn } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import type { CreateExperimentBody } from "@repo/api";
import type { LocationPoint } from "@repo/ui/components/map";

import { NewExperimentLocationsCard } from "./new-experiment-locations-card";

/* ─── useDebounce — timing, not HTTP ─────────────────────────── */

vi.mock("../../hooks/useDebounce", () => ({
  useDebounce: vi.fn((v: string) => [v, false]),
}));

/* ─── Map mock (captures props for assertions) ──────────────── */

let lastMapProps: Record<string, unknown> | null = null;

vi.mock("../map", () => ({
  Map: vi.fn((props: Record<string, unknown>) => {
    lastMapProps = props;
    const onSearch = props.onSearch as ((q: string) => void) | undefined;
    const onLocationAdd = props.onLocationAdd as
      | ((lat: number, lng: number) => Promise<LocationPoint | void>)
      | undefined;
    const onLocationsChange = props.onLocationsChange as
      | ((locs: LocationPoint[]) => void)
      | undefined;

    return (
      <div data-testid="map">
        <button data-testid="trigger-search" onClick={() => onSearch?.("test search")} />
        <button data-testid="add-location" onClick={() => onLocationAdd?.(52.52, 13.405)} />
        <button
          data-testid="change-locations"
          onClick={() =>
            onLocationsChange?.([{ id: "new-1", name: "New", latitude: 52.52, longitude: 13.405 }])
          }
        />
      </div>
    );
  }),
}));

/* ─── Form mock ──────────────────────────────────────────────── */

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

/* ─── Tests ──────────────────────────────────────────────────── */

describe("NewExperimentLocationsCard", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    lastMapProps = null;
    mockWatch.mockImplementation((f: string) => (f === "locations" ? [] : undefined));
  });

  it("renders card title and description", () => {
    render(<NewExperimentLocationsCard form={mockForm} />);
    expect(screen.getByText("newExperiment.addLocationsTitle")).toBeInTheDocument();
    expect(screen.getByText("newExperiment.addLocationsDescription")).toBeInTheDocument();
  });

  it("configures Map with correct defaults", () => {
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

  it("displays existing locations from form", () => {
    const locs: LocationPoint[] = [{ id: "1", name: "Berlin", latitude: 52.52, longitude: 13.405 }];
    mockWatch.mockImplementation((f: string) => (f === "locations" ? locs : undefined));
    render(<NewExperimentLocationsCard form={mockForm} />);
    expect(lastMapProps?.locations).toEqual(locs);
  });

  it("passes search results from MSW to Map", async () => {
    const results = [createPlace({ label: "Amsterdam", latitude: 52.37, longitude: 4.9 })];
    server.mount(contract.experiments.searchPlaces, { body: results });

    render(<NewExperimentLocationsCard form={mockForm} />);

    // Trigger search — sets searchQuery → debounce passes through → useLocationSearch fires
    await user.click(screen.getByTestId("trigger-search"));

    await waitFor(() => {
      expect(lastMapProps?.searchResults).toEqual(results);
    });
  });

  it("calls setValue on location change", async () => {
    render(<NewExperimentLocationsCard form={mockForm} />);
    await user.click(screen.getByTestId("change-locations"));
    expect(mockSetValue).toHaveBeenCalledWith(
      "locations",
      expect.arrayContaining([
        expect.objectContaining({ id: "new-1", latitude: 52.52, longitude: 13.405 }),
      ]),
    );
  });

  it("handles geocoded location via MSW on add-location", async () => {
    server.mount(contract.experiments.geocodeLocation, {
      body: [
        createPlace({
          label: "Berlin, Germany",
          latitude: 52.52,
          longitude: 13.405,
          country: "Germany",
          region: "Berlin",
          municipality: "Berlin",
          postalCode: "10115",
        }),
      ],
    });

    render(<NewExperimentLocationsCard form={mockForm} />);
    await user.click(screen.getByTestId("add-location"));

    await waitFor(() => {
      expect(mockSetValue).toHaveBeenCalledWith(
        "locations",
        expect.arrayContaining([
          expect.objectContaining({
            name: "Berlin, Germany",
            latitude: 52.52,
            longitude: 13.405,
            country: "Germany",
          }),
        ]),
      );
    });
  });

  it("handles empty/missing search data", () => {
    // Default MSW handler returns [], so searchResults should be []
    render(<NewExperimentLocationsCard form={mockForm} />);
    expect(lastMapProps?.searchResults).toEqual([]);
  });
});
