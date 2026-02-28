import { createExperimentTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";
import type { WizardFormProps } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import type { ChartFormValues } from "./chart-configurators/chart-configurator-util";
import EditVisualizationForm from "./edit-visualization-form";

vi.mock("@repo/ui/components", () => ({
  WizardForm: vi.fn(
    ({ onSubmit, defaultValues, isSubmitting }: WizardFormProps<ChartFormValues>) => (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(defaultValues as ChartFormValues);
        }}
      >
        <div data-testid="is-submitting">{isSubmitting ? "true" : "false"}</div>
        <button type="submit">Submit</button>
      </form>
    ),
  ),
}));

vi.mock("./wizard-steps/basic-info-step", () => ({
  BasicInfoStep: () => null,
  basicInfoSchema: () => ({}),
}));
vi.mock("./wizard-steps/chart-type-step", () => ({
  ChartTypeStep: () => null,
  chartTypeSchema: () => ({}),
}));
vi.mock("./wizard-steps/data-source-step", () => ({
  DataSourceStep: () => null,
  dataSourceSchema: () => ({}),
}));
vi.mock("./wizard-steps/appearance-step", () => ({
  AppearanceStep: () => null,
  appearanceSchema: () => ({}),
}));

function mountUpdate(body = createVisualization()) {
  return server.mount(contract.experiments.updateExperimentVisualization, { body });
}

describe("EditVisualizationForm", () => {
  const viz = createVisualization({
    id: "viz-1",
    experimentId: "exp-1",
    name: "Test Visualization",
    description: "A test description",
    chartType: "line",
    dataConfig: {
      tableName: "test_table",
      dataSources: [
        { tableName: "test_table", columnName: "x", role: "x" },
        { tableName: "test_table", columnName: "y", role: "y" },
      ],
    },
  });

  const defaultProps = {
    experimentId: "exp-1",
    visualization: viz,
    tables: [createExperimentTable({ name: "test_table", displayName: "Test Table" })],
    onSuccess: vi.fn(),
    isLoading: false,
    isPreviewOpen: false,
    onPreviewClose: vi.fn(),
  };

  it("shows loading spinner when isLoading is true", () => {
    render(<EditVisualizationForm {...defaultProps} isLoading={true} />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the wizard form when not loading", () => {
    mountUpdate();
    render(<EditVisualizationForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("submits update mutation with filtered data sources", async () => {
    const user = userEvent.setup();
    const spy = mountUpdate(createVisualization({ id: "viz-1" }));
    const vizWithEmpty = createVisualization({
      ...viz,
      dataConfig: {
        tableName: "test_table",
        dataSources: [
          { tableName: "test_table", columnName: "x", role: "x" },
          { tableName: "test_table", columnName: "", role: "y" },
          { tableName: "test_table", columnName: "z", role: "z" },
        ],
      },
    });

    render(<EditVisualizationForm {...defaultProps} visualization={vizWithEmpty} />);

    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });

    const submitted = spy.body as { dataConfig: { dataSources: { columnName: string }[] } };
    expect(submitted.dataConfig.dataSources).toHaveLength(2);
    expect(submitted.dataConfig.dataSources[0].columnName).toBe("x");
    expect(submitted.dataConfig.dataSources[1].columnName).toBe("z");
  });

  it("shows toast and calls onSuccess on successful update", async () => {
    const user = userEvent.setup();
    mountUpdate(createVisualization({ id: "viz-1" }));
    const onSuccess = vi.fn();

    render(<EditVisualizationForm {...defaultProps} onSuccess={onSuccess} />);

    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({ description: "ui.messages.updateSuccess" });
      expect(onSuccess).toHaveBeenCalledWith("viz-1");
    });
  });

  it("handles null description by defaulting to empty string", () => {
    mountUpdate();
    const vizNoDesc = createVisualization({ description: null as unknown as string });

    render(<EditVisualizationForm {...defaultProps} visualization={vizNoDesc} />);

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });
});
