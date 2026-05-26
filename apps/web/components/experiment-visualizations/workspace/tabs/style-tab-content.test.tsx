import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { StyleTabContent } from "./style-tab-content";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [{ name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" }];

describe("StyleTabContent", () => {
  it("renders the style panel for the active chart type", () => {
    renderWithForm<ChartFormValues>((form) => <StyleTabContent form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    // The line style panel registers a display options section as its first card.
    expect(screen.getByText("workspace.style.display")).toBeInTheDocument();
  });

  it("renders the unsupported placeholder for an unregistered chart type", () => {
    renderWithForm<ChartFormValues>((form) => <StyleTabContent form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({ chartType: "alluvial" }),
      },
    });

    expect(screen.getByText("errors.chartTypeNotSupported")).toBeInTheDocument();
  });

  it("does not show the unsupported placeholder for a supported chart type", () => {
    renderWithForm<ChartFormValues>((form) => <StyleTabContent form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.queryByText("errors.chartTypeNotSupported")).not.toBeInTheDocument();
  });

  it("re-renders the panel when chartType changes between supported types", () => {
    renderWithForm<ChartFormValues>((form) => <StyleTabContent form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({ chartType: "scatter" }),
      },
    });

    expect(screen.getByText("workspace.style.display")).toBeInTheDocument();
  });
});
