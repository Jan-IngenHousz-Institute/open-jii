import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";

import { RecentMeasurements } from "./recent-measurements";

const EXPERIMENT_ID = "22222222-2222-4222-8222-222222222222";
const PROTOCOL_ID = "55555555-5555-4555-8555-555555555555";

function measurement(overrides: Partial<DeviceMeasurement> = {}): DeviceMeasurement {
  return {
    timestamp: "2026-08-14T09:30:00.000Z",
    experimentId: EXPERIMENT_ID,
    protocolId: PROTOCOL_ID,
    workbookVersionId: null,
    deviceVersion: "1.1.0",
    battery: 4.16,
    latitude: 51.9851,
    longitude: 5.6634,
    sample: null,
    ...overrides,
  };
}

describe("RecentMeasurements", () => {
  it("lists the rows with their resolved experiment and protocol", () => {
    render(
      <RecentMeasurements
        measurements={[measurement()]}
        visibleExperiments={[{ id: EXPERIMENT_ID, name: "Soil Health" }]}
        visibleProtocols={[{ id: PROTOCOL_ID, name: "Moisture v2" }]}
        locale="en-US"
      />,
    );

    expect(screen.getByRole("link", { name: /Soil Health/ })).toHaveAttribute(
      "href",
      `/en-US/platform/experiments/${EXPERIMENT_ID}/data`,
    );
    expect(screen.getByRole("link", { name: /Moisture v2/ })).toBeInTheDocument();
    expect(screen.getByText("4.16")).toBeInTheDocument();
    expect(screen.getByText("51.985, 5.663")).toBeInTheDocument();
  });

  it("withholds an experiment the viewer cannot see, but names an undefined protocol", () => {
    render(
      <RecentMeasurements
        measurements={[measurement()]}
        visibleExperiments={[]}
        visibleProtocols={[]}
        locale="en-US"
      />,
    );

    // Experiments are access-controlled, so the id stays withheld; protocols
    // are not, so an unresolvable one is simply not defined here.
    expect(screen.queryByText(EXPERIMENT_ID)).not.toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.privateExperiment")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.unknownProtocolId")).toBeInTheDocument();
  });

  it("renders missing battery and location as dashes rather than blanks", () => {
    render(
      <RecentMeasurements
        measurements={[measurement({ battery: null, latitude: null, longitude: null })]}
        visibleExperiments={[]}
        visibleProtocols={[]}
        locale="en-US"
      />,
    );

    const cells = screen.getAllByText("-");
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });

  it("says so plainly when nothing arrived in the window", () => {
    render(
      <RecentMeasurements
        measurements={[]}
        visibleExperiments={[]}
        visibleProtocols={[]}
        locale="en-US"
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.noMeasurements")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
