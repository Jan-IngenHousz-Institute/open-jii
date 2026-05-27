import { createVisualization, createSession } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { useForm, FormProvider } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { VisualizationSettingsMenu } from "./visualization-settings-menu";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "My Chart",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
    ...overrides,
  };
}

function makeViz(overrides: Partial<ExperimentVisualization> = {}): ExperimentVisualization {
  return createVisualization({
    id: "viz-1",
    name: "My Chart",
    createdBy: "user-1",
    ...overrides,
  });
}

interface HarnessOpts {
  viz?: ExperimentVisualization;
  formDefaults?: ChartFormValues;
}

function Harness({ viz = makeViz(), formDefaults = defaults() }: HarnessOpts) {
  const form: UseFormReturn<ChartFormValues> = useForm<ChartFormValues>({
    defaultValues: formDefaults,
  });
  return (
    <FormProvider {...form}>
      <VisualizationSettingsMenu experimentId="exp-1" visualization={viz} />
    </FormProvider>
  );
}

describe("VisualizationSettingsMenu", () => {
  it("renders the actions dropdown trigger", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "ui.actions.title" })).toBeInTheDocument();
  });

  it("shows the clear + delete menu items after opening the dropdown", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "ui.actions.title" }));

    expect(
      await screen.findByText("workspace.detailsSidebar.clearVisualization"),
    ).toBeInTheDocument();
    expect(screen.getByText("workspace.detailsSidebar.deleteVisualization")).toBeInTheDocument();
  });

  it("opens the clear-confirmation dialog from the menu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "ui.actions.title" }));
    await user.click(await screen.findByText("workspace.detailsSidebar.clearVisualization"));

    expect(await screen.findByText("workspace.detailsSidebar.clearWarning")).toBeInTheDocument();
  });

  it("resets the config and dataConfig to the chart-type defaults on confirm clear", async () => {
    const user = userEvent.setup();
    let formRef!: UseFormReturn<ChartFormValues>;
    function Capture() {
      formRef = useForm<ChartFormValues>({
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
            ],
          },
        }),
      });
      return (
        <FormProvider {...formRef}>
          <VisualizationSettingsMenu experimentId="exp-1" visualization={makeViz()} />
        </FormProvider>
      );
    }

    render(<Capture />);
    await user.click(screen.getByRole("button", { name: "ui.actions.title" }));
    await user.click(await screen.findByText("workspace.detailsSidebar.clearVisualization"));
    await user.click(await screen.findByText("workspace.detailsSidebar.clearConfirm"));

    const sources = formRef.getValues("dataConfig.dataSources");
    expect(sources.every((s) => !s.columnName)).toBe(true);
    // Same tableName carries over so the user doesn't lose dataset context.
    expect(formRef.getValues("dataConfig.tableName")).toBe("readings");
  });

  it("opens the delete-confirmation dialog from the menu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "ui.actions.title" }));
    await user.click(await screen.findByText("workspace.detailsSidebar.deleteVisualization"));

    expect(await screen.findByText("common.confirmDelete")).toBeInTheDocument();
  });

  it("issues the delete request and routes back to the experiment on confirm", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: createSession({ user: { id: "user-1" } }),
      isPending: false,
    } as never);
    const spy = server.mount(contract.experiments.deleteExperimentVisualization, {
      status: 204,
      body: null,
    });

    const user = userEvent.setup();
    const { router } = render(<Harness />);

    await user.click(screen.getByRole("button", { name: "ui.actions.title" }));
    await user.click(await screen.findByText("workspace.detailsSidebar.deleteVisualization"));
    await user.click(await screen.findByText("workspace.detailsSidebar.deleteConfirm"));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments/exp-1");
  });

  it("closes the clear dialog when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "ui.actions.title" }));
    await user.click(await screen.findByText("workspace.detailsSidebar.clearVisualization"));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "common.cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("workspace.detailsSidebar.clearWarning")).not.toBeInTheDocument();
    });
  });

  it("closes the delete dialog when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "ui.actions.title" }));
    await user.click(await screen.findByText("workspace.detailsSidebar.deleteVisualization"));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "common.cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("common.confirmDelete")).not.toBeInTheDocument();
    });
  });

  it("toasts when the delete request fails", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: createSession({ user: { id: "user-1" } }),
      isPending: false,
    } as never);
    server.mount(contract.experiments.deleteExperimentVisualization, {
      status: 500,
      body: { message: "boom" },
    });

    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "ui.actions.title" }));
    await user.click(await screen.findByText("workspace.detailsSidebar.deleteVisualization"));
    await user.click(await screen.findByText("workspace.detailsSidebar.deleteConfirm"));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "workspace.detailsSidebar.deleteVisualization",
          variant: "destructive",
        }),
      );
    });
  });
});
