import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { FacetStyleSection } from "./facet-style-section";

function withFacet(): ChartFormValues {
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
        { tableName: "readings", columnName: "site", role: "facet" },
      ],
    },
  };
}

function withoutFacet(): ChartFormValues {
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

describe("FacetStyleSection", () => {
  it("renders nothing when no facet data source is set", () => {
    const { container } = renderWithForm<ChartFormValues>(
      (form) => <FacetStyleSection form={form} />,
      { useFormProps: { defaultValues: withoutFacet() } },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the section heading once a facet data source exists", () => {
    renderWithForm<ChartFormValues>((form) => <FacetStyleSection form={form} />, {
      useFormProps: { defaultValues: withFacet() },
    });
    expect(
      screen.getByRole("heading", { name: "workspace.style.facetOptions" }),
    ).toBeInTheDocument();
  });

  it("exposes the column-count slider and shared-axis checkboxes when expanded", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <FacetStyleSection form={form} />, {
      useFormProps: { defaultValues: withFacet() },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.facetOptions" }));
    expect(await screen.findByText("workspace.style.facetColumns")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.facetSharedX")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.facetSharedY")).toBeInTheDocument();
  });

  it("renders nothing when the only facet data source has an empty columnName", () => {
    const formValues: ChartFormValues = {
      ...withoutFacet(),
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "", role: "facet" },
        ],
      },
    };
    const { container } = renderWithForm<ChartFormValues>(
      (form) => <FacetStyleSection form={form} />,
      { useFormProps: { defaultValues: formValues } },
    );
    expect(container).toBeEmptyDOMElement();
  });
});
