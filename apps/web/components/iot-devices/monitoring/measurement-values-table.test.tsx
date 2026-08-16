import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";

import { MeasurementValuesTable } from "./measurement-values-table";

function measurement(sample: string | null, timestamp: string): DeviceMeasurement {
  return {
    timestamp,
    experimentId: null,
    protocolId: null,
    workbookVersionId: null,
    deviceVersion: "1.1.0",
    battery: null,
    latitude: null,
    longitude: null,
    sample,
  };
}

describe("MeasurementValuesTable", () => {
  it("gives every reported field its own column, typed from the data", () => {
    render(
      <MeasurementValuesTable
        measurements={[
          measurement(
            JSON.stringify({ phi2: 0.71, note: "field run", envelope: { gain: 3 } }),
            "2026-08-14T09:30:00.000Z",
          ),
        ]}
      />,
    );

    expect(screen.getByText("phi2")).toBeInTheDocument();
    expect(screen.getByText("note")).toBeInTheDocument();
    expect(screen.getByText("envelope")).toBeInTheDocument();
    // Numbers keep the numeric cell treatment the experiment tables give them.
    expect(screen.getByText("0.71").className).toContain("text-right");
    expect(screen.getByText("field run")).toBeInTheDocument();
  });

  it("renders the measurement time as the platform renders timestamps", () => {
    render(
      <MeasurementValuesTable
        measurements={[measurement(JSON.stringify({ phi2: 0.71 }), "2026-08-14T09:30:00.000Z")]}
      />,
    );

    expect(screen.getByText("2026-08-14 09:30:00")).toBeInTheDocument();
  });

  it("starts at five readings and lets the viewer ask for more", () => {
    const readings = Array.from({ length: 8 }, (_, index) =>
      measurement(JSON.stringify({ phi2: index / 100 }), `2026-08-14T09:3${String(index)}:00.000Z`),
    );

    render(<MeasurementValuesTable measurements={readings} />);

    expect(screen.getByText(/dataTable.totalRows.*8/)).toBeInTheDocument();
    expect(screen.getByText("0.04")).toBeInTheDocument();
    expect(screen.queryByText("0.05")).not.toBeInTheDocument();
  });

  it("says nothing arrived when there are no measurements", () => {
    render(<MeasurementValuesTable measurements={[]} />);

    expect(screen.getByText("iot.devices.monitoring.noMeasurements")).toBeInTheDocument();
  });

  it("distinguishes measurements that arrived but carried no readable sample", () => {
    render(
      <MeasurementValuesTable measurements={[measurement(null, "2026-08-14T09:30:00.000Z")]} />,
    );

    expect(screen.getByText("iot.devices.monitoring.noReadableSamples")).toBeInTheDocument();
  });
});
