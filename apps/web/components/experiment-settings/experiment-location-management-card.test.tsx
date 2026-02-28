import { createLocation } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { ExperimentLocationManagement } from "./experiment-location-management-card";

// Pragmatic mock – Leaflet Map has no jsdom support (canvas / WebGL)
vi.mock("../map", () => ({
  Map: ({
    locations,
    onLocationsChange,
    sidebarTitle,
  }: {
    locations: { id: string; name: string; latitude: number; longitude: number }[];
    onLocationsChange?: (locs: typeof locations) => void;
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
