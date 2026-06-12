import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ChartFormValues } from "../../../charts/chart-config";
import { densityPlot2DChartType } from "../../../charts/statistical/density-plot-2d";
import { ContinuousColorSettings } from "./continuous-color-settings";

function defaults(overrides: Partial<ChartFormValues["config"]> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: densityPlot2DChartType.family,
    chartType: densityPlot2DChartType.type,
    config: {
      ...densityPlot2DChartType.defaultConfig(),
      marker: {
        colorscale: "Viridis",
        showscale: true,
        reversescale: false,
        colorbar: { title: { text: "", side: "right" } },
      },
      ...overrides,
    },
    dataConfig: densityPlot2DChartType.defaultDataConfig(),
  };
}

function renderSettings(values: ChartFormValues = defaults()) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <ContinuousColorSettings
        control={form.control}
        previewGradient="linear-gradient(to right, #000, #fff)"
        showColorbarId="show-colorbar"
      />
    ),
    { useFormProps: { defaultValues: values } },
  );
}

describe("ContinuousColorSettings", () => {
  it("renders the colorscale, axis title, position, and reverse-scale controls", () => {
    renderSettings();
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitlePosition")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.reverseScale")).toBeInTheDocument();
  });

  it("renders the preview swatch with the provided gradient", () => {
    const { container } = renderSettings();
    expect(screen.getByText("workspace.shelves.preview")).toBeInTheDocument();
    const preview = container.querySelector(".w-full.h-5");
    expect(preview).toHaveStyle({ background: "linear-gradient(to right, #000, #fff)" });
  });

  it("renders the colorbar-title input bound to the form value", () => {
    renderSettings(defaults({ marker: { colorbar: { title: { text: "My Title" } } } }));
    expect(screen.getByDisplayValue("My Title")).toBeInTheDocument();
  });

  it("renders the show-colorbar checkbox with the supplied id, checked when showscale is true", () => {
    renderSettings();
    const checkbox = screen.getByLabelText("workspace.shelves.showColorbar");
    expect(checkbox).toHaveAttribute("id", "show-colorbar");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("toggles the reverse-scale checkbox state when clicked", async () => {
    const user = userEvent.setup();
    renderSettings();
    const reverse = screen.getByLabelText("workspace.shelves.reverseScale");
    expect(reverse).toHaveAttribute("data-state", "unchecked");
    await user.click(reverse);
    expect(reverse).toHaveAttribute("data-state", "checked");
  });

  it("uses 'Viridis' as the colorscale fallback when the form value isn't a string", () => {
    renderSettings(defaults({ marker: { colorscale: undefined } }));
    expect(screen.getByText("workspace.colorscales.viridis")).toBeInTheDocument();
  });
});
