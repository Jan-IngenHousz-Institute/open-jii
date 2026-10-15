import { createLocation, createPlace } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ExperimentLocationManagement } from "./experiment-location-management-card";

vi.mock("../map", () => ({
  Map: ({
    locations,
    onLocationsChange,
    onLocationAdd,
    sidebarTitle,
  }: {
    locations: { id: string; name: string; latitude: number; longitude: number }[];
    onLocationsChange?: (locs: typeof locations) => void;
    onLocationAdd?: (lat: number, lng: number) => Promise<(typeof locations)[number] | void>;
    sidebarTitle: string;
  }) => (
    <div role="application" aria-label={sidebarTitle}>
      <span>{locations.length} locations</span>
      <button
        onClick={() =>
          onLocationsChange?.([
            ...locations,
            { id: "new-1", name: "New Location", latitude: 40.76, longitude: -73.99 },
          ])
        }
      >
        Add Location
      </button>
      <button onClick={() => onLocationsChange?.(locations.slice(0, -1))}>Remove Location</button>
      <button
        onClick={async () => {
          const added = await onLocationAdd?.(52.52, 13.405);
          if (added) onLocationsChange?.([...locations, added]);
        }}
      >
        Click Map
      </button>
    </div>
  ),
}));

const experimentId = "exp-123";

function mountLocations(locations = [createLocation(), createLocation()]) {
  return server.mount(contract.experiments.getExperimentLocations, { body: locations });
}

function mountUpdate() {
  return server.mount(contract.experiments.updateExperimentLocations, { body: [] });
}

describe("ExperimentLocationManagement", () => {
  it("renders loading skeleton while fetching locations", () => {
    server.mount(contract.experiments.getExperimentLocations, {
      body: [],
      delay: 999_999,
    });

    render(<ExperimentLocationManagement experimentId={experimentId} />);

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByRole("application")).not.toBeInTheDocument();
  });

  it("renders map when locations are loaded", async () => {
    mountLocations();

    render(<ExperimentLocationManagement experimentId={experimentId} />);

    await waitFor(() => {
      expect(screen.getByRole("application")).toBeInTheDocument();
    });
  });

  it("displays editing count when locations exist", async () => {
    mountLocations([createLocation(), createLocation()]);

    render(<ExperimentLocationManagement experimentId={experimentId} />);

    await waitFor(() => {
      expect(screen.getByText("settings.locations.editingCount")).toBeInTheDocument();
    });
  });

  it("hides editing count when no locations", async () => {
    mountLocations([]);

    render(<ExperimentLocationManagement experimentId={experimentId} />);

    await waitFor(() => {
      expect(screen.getByRole("application")).toBeInTheDocument();
    });

    expect(screen.queryByText("settings.locations.editingCount")).not.toBeInTheDocument();
  });

  it("auto-saves when a location is added", async () => {
    const user = userEvent.setup();
    mountLocations([createLocation()]);
    const updateSpy = mountUpdate();

    render(<ExperimentLocationManagement experimentId={experimentId} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Location" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add Location" }));

    await waitFor(() => {
      expect(updateSpy.callCount).toBe(1);
    });
  });

  it("auto-saves when a location is removed", async () => {
    const user = userEvent.setup();
    mountLocations([createLocation(), createLocation()]);
    const updateSpy = mountUpdate();

    render(<ExperimentLocationManagement experimentId={experimentId} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove Location" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Remove Location" }));

    await waitFor(() => {
      expect(updateSpy.callCount).toBe(1);
    });
  });

  it("geocodes a map click and saves the named location", async () => {
    const user = userEvent.setup();
    mountLocations([createLocation()]);
    server.mount(contract.experiments.geocodeLocation, {
      body: [
        createPlace({
          label: "Berlin, Germany",
          latitude: 52.52,
          longitude: 13.405,
          country: "Germany",
        }),
      ],
    });
    const updateSpy = mountUpdate();

    render(<ExperimentLocationManagement experimentId={experimentId} hasAccess />);

    await user.click(await screen.findByRole("button", { name: "Click Map" }));

    await waitFor(() => {
      expect(updateSpy.callCount).toBe(1);
    });
    expect(updateSpy.body).toMatchObject({
      locations: [
        {},
        {
          name: "Berlin, Germany",
          latitude: 52.52,
          longitude: 13.405,
          country: "Germany",
          addressLabel: "Berlin, Germany",
        },
      ],
    });
    expect(screen.getByText("2 locations")).toBeInTheDocument();
  });

  it("keeps a removal made while a map click is still geocoding", async () => {
    const user = userEvent.setup();
    mountLocations([createLocation({ name: "Keep" }), createLocation({ name: "Removed" })]);
    server.mount(contract.experiments.geocodeLocation, {
      body: [createPlace({ label: "Berlin, Germany", latitude: 52.52, longitude: 13.405 })],
      delay: 200,
    });
    const updateSpy = mountUpdate();

    render(<ExperimentLocationManagement experimentId={experimentId} hasAccess />);

    await user.click(await screen.findByRole("button", { name: "Click Map" }));
    await user.click(screen.getByRole("button", { name: "Remove Location" }));

    await waitFor(() => {
      expect(updateSpy.callCount).toBe(2);
    });
    expect(updateSpy.body).toMatchObject({
      locations: [{ name: "Keep" }, { name: "Berlin, Germany" }],
    });
    expect((updateSpy.body as { locations: unknown[] }).locations).toHaveLength(2);
  });

  it("adds a location for each of two quick map clicks", async () => {
    const user = userEvent.setup();
    mountLocations([createLocation({ name: "Keep" })]);
    server.mount(contract.experiments.geocodeLocation, {
      body: [createPlace({ label: "Berlin, Germany", latitude: 52.52, longitude: 13.405 })],
      delay: 100,
    });
    const updateSpy = mountUpdate();

    render(<ExperimentLocationManagement experimentId={experimentId} hasAccess />);

    const clickMap = await screen.findByRole("button", { name: "Click Map" });
    await user.click(clickMap);
    await user.click(clickMap);

    await waitFor(() => {
      expect(updateSpy.callCount).toBe(2);
    });
    expect((updateSpy.body as { locations: unknown[] }).locations).toHaveLength(3);
  });

  it("saves nothing when the map click has no address", async () => {
    const user = userEvent.setup();
    mountLocations([createLocation()]);
    const geocodeSpy = server.mount(contract.experiments.geocodeLocation, { body: [] });
    const updateSpy = mountUpdate();

    render(<ExperimentLocationManagement experimentId={experimentId} hasAccess />);

    await user.click(await screen.findByRole("button", { name: "Click Map" }));

    await waitFor(() => {
      expect(geocodeSpy.callCount).toBe(1);
    });
    expect(updateSpy.callCount).toBe(0);
  });

  it("passes sidebar title to map", async () => {
    mountLocations();

    render(<ExperimentLocationManagement experimentId={experimentId} />);

    await waitFor(() => {
      expect(
        screen.getByRole("application", { name: "settings.locations.editMode" }),
      ).toBeInTheDocument();
    });
  });
});
