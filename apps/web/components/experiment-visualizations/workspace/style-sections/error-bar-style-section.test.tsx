import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { ErrorBarStyleSection } from "./error-bar-style-section";

function withErrorColumn(): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "temp", role: "y", errorColumn: "temp_err" },
      ],
    },
  };
}

function withoutErrorColumn(): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "temp", role: "y" },
      ],
    },
  };
}

describe("ErrorBarStyleSection", () => {
  it("renders nothing when no data source has an errorColumn", () => {
    const { container } = renderWithForm<ChartFormValues>(
      (form) => <ErrorBarStyleSection form={form} />,
      { useFormProps: { defaultValues: withoutErrorColumn() } },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the section heading once any series has an errorColumn", () => {
    renderWithForm<ChartFormValues>((form) => <ErrorBarStyleSection form={form} />, {
      useFormProps: { defaultValues: withErrorColumn() },
    });
    expect(
      screen.getByRole("heading", { name: "workspace.style.errorBarOptions" }),
    ).toBeInTheDocument();
  });

  it("exposes thickness and cap-width sliders when expanded", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <ErrorBarStyleSection form={form} />, {
      useFormProps: { defaultValues: withErrorColumn() },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.errorBarOptions" }));
    expect(await screen.findByText("workspace.style.errorBarThickness")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.errorBarCapWidth")).toBeInTheDocument();
  });

  it("renders nothing when only a non-Y data source carries an errorColumn", () => {
    const formValues: ChartFormValues = {
      ...withoutErrorColumn(),
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x", errorColumn: "time_err" },
          { tableName: "readings", columnName: "temp", role: "y" },
        ],
      },
    };
    const { container } = renderWithForm<ChartFormValues>(
      (form) => <ErrorBarStyleSection form={form} />,
      { useFormProps: { defaultValues: formValues } },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when errorColumn is an empty string", () => {
    const formValues: ChartFormValues = {
      ...withoutErrorColumn(),
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "temp", role: "y", errorColumn: "" },
        ],
      },
    };
    const { container } = renderWithForm<ChartFormValues>(
      (form) => <ErrorBarStyleSection form={form} />,
      { useFormProps: { defaultValues: formValues } },
    );
    expect(container).toBeEmptyDOMElement();
  });
});
