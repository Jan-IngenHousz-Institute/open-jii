import { createExperimentTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";
import type { ExperimentTableMetadata } from "@repo/api";
import type { WizardFormProps } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import type { ChartFormValues } from "./chart-configurators/chart-configurator-util";
import NewVisualizationForm from "./new-visualization-form";

vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    WizardForm: vi.fn(({ defaultValues, onSubmit }: WizardFormProps<ChartFormValues>) => (
      <div>
        <button
          onClick={() => {
            if (defaultValues) void onSubmit(defaultValues as ChartFormValues);
          }}
        >
          Submit
        </button>
      </div>
    )),
  };
});

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

function mountCreate(body = createVisualization()) {
  return server.mount(contract.experiments.createExperimentVisualization, { body });
}

const tables: ExperimentTableMetadata[] = [
  createExperimentTable({ name: "measurements", displayName: "Measurements" }),
  createExperimentTable({ name: "observations", displayName: "Observations" }),
];

const defaultProps = {
  experimentId: "exp-1",
  tables,
  onSuccess: vi.fn(),
  isPreviewOpen: false,
  onPreviewClose: vi.fn(),
};

describe("NewVisualizationForm", () => {
  it("shows loading spinner when isLoading is true", () => {
    render(<NewVisualizationForm {...defaultProps} isLoading={true} />);

    expect(document.querySelector(".lucide-loader-circle")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
  });

  it("renders the wizard form when not loading", () => {
    render(<NewVisualizationForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("submits filtered data sources on form submit", async () => {
    const user = userEvent.setup();
    const spy = mountCreate(createVisualization({ id: "viz-new" }));

    // WizardForm mock will submit defaultValues. Since getDefaultDataConfig runs for real
    // with tableName "measurements", the default dataSources have empty columnName → all filtered out.
    render(<NewVisualizationForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });

    // getDefaultDataConfig returns dataSources with empty columnName → filtered to empty
    const submitted = spy.body as { dataConfig: { dataSources: unknown[] } };
    expect(submitted.dataConfig.dataSources).toHaveLength(0);
  });

  it("shows toast and calls onSuccess on successful creation", async () => {
    const user = userEvent.setup();
    mountCreate(createVisualization({ id: "viz-789" }));
    const onSuccess = vi.fn();

    render(<NewVisualizationForm {...defaultProps} onSuccess={onSuccess} />);

    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({ description: "ui.messages.createSuccess" });
      expect(onSuccess).toHaveBeenCalledWith("viz-789");
    });
  });

  it("handles empty table list gracefully", () => {
    render(<NewVisualizationForm {...defaultProps} tables={[]} />);

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });
});
