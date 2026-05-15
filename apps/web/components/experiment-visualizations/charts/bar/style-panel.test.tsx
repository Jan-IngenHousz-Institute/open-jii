import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { barChartType } from ".";
import type { ChartFormValues } from "../form-values";
import { BarStylePanel } from "./style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: barChartType.family,
    chartType: barChartType.type,
    config: barChartType.defaultConfig(),
    dataConfig: barChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  {
    name: "contributor",
    type_name: "STRUCT",
    type_text: "STRUCT<id: STRING, name: STRING, avatar: STRING>",
  },
  { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <BarStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("BarStylePanel", () => {
  it("renders layout + ranking subsections", () => {
    renderPanel();
    expect(screen.getByText("workspace.bar.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.bar.sortDirection")).toBeInTheDocument();
    expect(screen.getByText("workspace.bar.topN")).toBeInTheDocument();
  });

  it("renders the orientation picker with vertical as the default", () => {
    renderPanel();
    // shadcn Select sets the picked option's text in the trigger; default is "v".
    expect(screen.getByText("workspace.bar.orientations.vertical")).toBeInTheDocument();
  });

  it("renders 'None' for sortDirection when the form value is null (default)", () => {
    renderPanel();
    // The "None (input order)" label is what we want shown by default.
    expect(screen.getByText("workspace.bar.sortOptions.none")).toBeInTheDocument();
  });

  it("renders the picked sortDirection when not null", () => {
    renderPanel(defaults({ config: { ...barChartType.defaultConfig(), sortDirection: "desc" } }));
    expect(screen.getByText("workspace.bar.sortOptions.desc")).toBeInTheDocument();
  });

  it("shows the topN value in the number input when set", () => {
    renderPanel(defaults({ config: { ...barChartType.defaultConfig(), topN: 5 } }));
    expect(screen.getByRole("spinbutton")).toHaveValue(5);
  });

  it("renders an empty topN input when the form value is undefined", () => {
    renderPanel();
    expect(screen.getByRole("spinbutton")).toHaveValue(null);
  });
});
