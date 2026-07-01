import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { bubbleChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { BubbleStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: bubbleChartType.family,
    chartType: bubbleChartType.type,
    config: bubbleChartType.defaultConfig(),
    dataConfig: bubbleChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "weight", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <BubbleStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("BubbleStylePanel", () => {
  it("shows sizemode, max/min sizing and marker controls", () => {
    renderPanel();
    expandSection("workspace.style.bubbleOptions");
    expect(screen.getByText("workspace.style.sizemode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.maxBubbleSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.minBubbleSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerShape")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("does not surface line-only options", () => {
    renderPanel();
    expandSection("workspace.style.bubbleOptions");
    expect(screen.queryByText("workspace.style.lineWidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.smoothing")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.connectGaps")).not.toBeInTheDocument();
  });

  it("renders the line-series subsection when any Y source has traceType=line", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "cells",
          dataSources: [
            { tableName: "cells", columnName: "x", role: "x" },
            { tableName: "cells", columnName: "y", role: "y", traceType: "line" },
            { tableName: "cells", columnName: "weight", role: "size" },
          ],
        },
      }),
    );
    expect(screen.getByText("workspace.style.lineSeriesOptions")).toBeInTheDocument();
  });

  it("renders the bar-series subsection when any Y source has traceType=bar", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "cells",
          dataSources: [
            { tableName: "cells", columnName: "x", role: "x" },
            { tableName: "cells", columnName: "y", role: "y", traceType: "bar" },
            { tableName: "cells", columnName: "weight", role: "size" },
          ],
        },
      }),
    );
    expect(screen.getByText("workspace.style.barSeriesOptions")).toBeInTheDocument();
  });

  it("renders the area-series subsection when any Y source has traceType=area", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "cells",
          dataSources: [
            { tableName: "cells", columnName: "x", role: "x" },
            { tableName: "cells", columnName: "y", role: "y", traceType: "area" },
            { tableName: "cells", columnName: "weight", role: "size" },
          ],
        },
      }),
    );
    expect(screen.getByText("workspace.style.areaSeriesOptions")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.bubbleOptions");
    expect(screen.getByText("workspace.style.sizemode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.maxBubbleSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.minBubbleSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerShape")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });
});
