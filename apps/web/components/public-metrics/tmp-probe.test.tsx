import { render } from "@/test/test-utils";
import { describe, it, vi } from "vitest";

import type { MetricsActivityDay } from "@repo/api/domains/metrics/metrics.schema";

import { ActivityChart } from "./activity-chart";

const captured: unknown[] = [];

vi.mock("react-plotly.js", () => ({
  default: (props: Record<string, unknown>) => {
    captured.push({ data: props.data, layout: props.layout, config: props.config });
    return null;
  },
}));

const data: MetricsActivityDay[] = [
  { date: "2026-08-27", measurements: 20, cumulativeMeasurements: 980, volumeBytes: 400_000 },
  { date: "2026-08-28", measurements: 31, cumulativeMeasurements: 1_011, volumeBytes: 410_000 },
];

describe("probe", () => {
  it("captures what reaches plotly", async () => {
    render(<ActivityChart data={data} locale="en-US" />);
    await new Promise((r) => setTimeout(r, 200));
    console.log("CAPTURED", JSON.stringify(captured, null, 2).slice(0, 3000));
  });
});
