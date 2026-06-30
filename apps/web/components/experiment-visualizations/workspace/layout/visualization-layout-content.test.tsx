import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useForm, FormProvider } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";
import type { ExperimentVisualization } from "@repo/api/domains/experiment/experiment.schema";
import { useSession } from "@repo/auth/client";

import {
  AutosaveStatusProvider,
  useReportAutosaveStatus,
} from "../../../shared/autosave/autosave-status-context";
import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { VisualizationLayoutContent } from "./visualization-layout-content";

function makeViz(overrides: Partial<ExperimentVisualization> = {}): ExperimentVisualization {
  return createVisualization({
    id: "viz-1",
    name: "My Chart",
    description: "Original desc",
    createdBy: "user-creator",
    createdByName: "Creator User",
    createdAt: new Date("2024-01-01").toISOString(),
    updatedAt: new Date("2024-01-15").toISOString(),
    ...overrides,
  });
}

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "My Chart",
    description: "Original desc",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
    ...overrides,
  };
}

function Harness({
  viz,
  formDefaults = defaults(),
  experimentId = "exp-1",
}: {
  viz: ExperimentVisualization;
  formDefaults?: ChartFormValues;
  experimentId?: string;
}) {
  const form = useForm<ChartFormValues>({ defaultValues: formDefaults });
  return (
    <FormProvider {...form}>
      <AutosaveStatusProvider>
        <VisualizationLayoutContent experimentId={experimentId} visualization={viz}>
          <div data-testid="children">child-body</div>
        </VisualizationLayoutContent>
      </AutosaveStatusProvider>
    </FormProvider>
  );
}

describe("VisualizationLayoutContent", () => {
  it("renders the visualization name (from form), description, metadata, and children", () => {
    render(<Harness viz={makeViz()} />);

    expect(screen.getByText("My Chart")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Original desc")).toBeInTheDocument();
    expect(screen.getByText("Creator User")).toBeInTheDocument();
    expect(screen.getByTestId("children")).toBeInTheDocument();
  });

  it("falls back to the untitled placeholder when the form name is empty", () => {
    render(<Harness viz={makeViz({ name: "Whatever" })} formDefaults={defaults({ name: "" })} />);

    expect(screen.getByText("workspace.layout.untitled")).toBeInTheDocument();
  });

  it("hides the settings menu when the current user is not the visualization's creator", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "other-user" } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(<Harness viz={makeViz({ createdBy: "user-creator" })} />);

    expect(screen.queryByRole("button", { name: /ui\.actions\.title/ })).not.toBeInTheDocument();
  });

  it("shows the settings menu and enables the description textarea when the user IS the creator", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-creator" } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(<Harness viz={makeViz({ createdBy: "user-creator" })} />);

    expect(screen.getByRole("button", { name: /ui\.actions\.title/ })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Original desc")).not.toBeDisabled();
  });

  it("writes typed characters back into the form's description field", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-creator" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;

    function CaptureHarness({ viz }: { viz: ExperimentVisualization }) {
      formRef = useForm<ChartFormValues>({ defaultValues: defaults() });
      return (
        <FormProvider {...formRef}>
          <AutosaveStatusProvider>
            <VisualizationLayoutContent experimentId="exp-1" visualization={viz}>
              <div />
            </VisualizationLayoutContent>
          </AutosaveStatusProvider>
        </FormProvider>
      );
    }

    render(<CaptureHarness viz={makeViz({ createdBy: "user-creator" })} />);

    const textarea = screen.getByDisplayValue("Original desc");
    await user.clear(textarea);
    await user.type(textarea, "Updated");
    expect(formRef.getValues("description")).toBe("Updated");
  });

  it("shows the saved indicator at idle and the saving indicator when status reports saving", () => {
    function Report({ status }: { status: "idle" | "saving" }) {
      useReportAutosaveStatus({ status, error: null });
      return null;
    }
    function StatusHarness({ status }: { status: "idle" | "saving" }) {
      const form = useForm<ChartFormValues>({ defaultValues: defaults() });
      return (
        <FormProvider {...form}>
          <AutosaveStatusProvider>
            <VisualizationLayoutContent experimentId="exp-1" visualization={makeViz()}>
              <Report status={status} />
            </VisualizationLayoutContent>
          </AutosaveStatusProvider>
        </FormProvider>
      );
    }
    const { rerender } = render(<StatusHarness status="idle" />);
    expect(screen.getByText("autosave.saved")).toBeInTheDocument();
    rerender(<StatusHarness status="saving" />);
    expect(screen.getByText("autosave.saving")).toBeInTheDocument();
  });

  it("opens the delete dialog from the settings menu and fires deletion via the API", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-creator" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const spy = server.mount(orpcContract.experiments.deleteExperimentVisualization, {});
    const user = userEvent.setup();

    render(<Harness viz={makeViz({ id: "viz-9", createdBy: "user-creator" })} />);

    await user.click(screen.getByRole("button", { name: /ui\.actions\.title/ }));
    await user.click(await screen.findByText("workspace.detailsSidebar.deleteVisualization"));
    await user.click(
      screen.getByRole("button", { name: "workspace.detailsSidebar.deleteConfirm" }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "exp-1", visualizationId: "viz-9" });
  });

  it("clears config + dataConfig back to chart-type defaults when the clear dialog is confirmed", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-creator" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const user = userEvent.setup();

    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    function CaptureHarness() {
      formRef = useForm<ChartFormValues>({
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y", alias: "Temp" },
            ],
          },
        }),
      });
      return (
        <FormProvider {...formRef}>
          <AutosaveStatusProvider>
            <VisualizationLayoutContent
              experimentId="exp-1"
              visualization={makeViz({ createdBy: "user-creator" })}
            >
              <div />
            </VisualizationLayoutContent>
          </AutosaveStatusProvider>
        </FormProvider>
      );
    }

    render(<CaptureHarness />);

    await user.click(screen.getByRole("button", { name: /ui\.actions\.title/ }));
    await user.click(await screen.findByText(/clearVisualization/));
    await user.click(screen.getByRole("button", { name: "workspace.detailsSidebar.clearConfirm" }));

    // Default line dataConfig has a `time`/`value` X/Y pair from a fresh tableName.
    const cleared = formRef.getValues("dataConfig");
    expect(cleared.tableName).toBe("readings");
    // Aliases are wiped — defaultDataConfig produces blank entries.
    expect(cleared.dataSources.find((d) => d.role === "y")?.alias).toBe("");
  });
});
