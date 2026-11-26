import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ActivityIndicator } from "./activity-indicator";

describe("ActivityIndicator", () => {
  it("shows the moving 24h count when there is activity", () => {
    render(
      <ActivityIndicator
        measurements24h={1428}
        lastMeasurementAt="2026-08-28 10:00:00"
        locale="en-US"
      />,
    );

    expect(screen.getByText("indicator.active")).toBeInTheDocument();
  });

  it("falls back to quiet-since only when there is silence to report", async () => {
    render(
      <ActivityIndicator
        measurements24h={0}
        lastMeasurementAt="2026-08-01 10:00:00"
        locale="en-US"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("indicator.quiet")).toBeInTheDocument();
    });
  });

  it("renders nothing without activity or a last timestamp", () => {
    const { container } = render(
      <ActivityIndicator measurements24h={0} lastMeasurementAt={null} locale="en-US" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
