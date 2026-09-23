import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, fireEvent, render, screen, waitFor } from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { AutosaveIndicator } from "../../../shared/autosave/autosave-indicator";
import { AutosaveStatusProvider } from "../../../shared/autosave/autosave-status-context";
import type { DashboardFormValues } from "../../dashboard-form-shell";
import { useDashboardAutosave } from "./use-dashboard-autosave";

function defaults(): DashboardFormValues {
  return {
    name: "Untitled",
    description: "",
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    widgets: [],
  };
}

function Wrapper({ enabled, children }: { enabled?: boolean; children: ReactNode }) {
  const form = useForm<DashboardFormValues>({ defaultValues: defaults() });
  return (
    <AutosaveStatusProvider>
      <FormProvider {...form}>
        <Inner form={form} enabled={enabled}>
          {children}
        </Inner>
      </FormProvider>
    </AutosaveStatusProvider>
  );
}

function Inner({
  form,
  enabled,
  children,
}: {
  form: ReturnType<typeof useForm<DashboardFormValues>>;
  enabled?: boolean;
  children: ReactNode;
}) {
  useDashboardAutosave({ form, experimentId: "exp-1", dashboardId: "dash-1", enabled });

  const rename = () => form.setValue("name", "Renamed");

  return (
    <>
      <button type="button" onClick={rename}>
        rename
      </button>
      {children}
    </>
  );
}

describe("useDashboardAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts without firing a save on the initial form value", () => {
    const spy = server.mount(contract.experiments.updateExperimentDashboard, {
      status: 200,
      body: createExperimentDashboard({ id: "dash-1" }),
    });

    render(<Wrapper>{null}</Wrapper>);
    expect(spy.called).toBe(false);
  });

  it("saves an edit", async () => {
    const spy = server.mount(contract.experiments.updateExperimentDashboard, {
      status: 200,
      body: createExperimentDashboard({ id: "dash-1" }),
    });

    render(<Wrapper>{null}</Wrapper>);
    fireEvent.click(screen.getByRole("button", { name: "rename" }));
    await act(() => vi.advanceTimersByTimeAsync(1500));

    await waitFor(() => expect(spy.called).toBe(true));
  });

  it("neither saves nor reports a status while disabled", async () => {
    const spy = server.mount(contract.experiments.updateExperimentDashboard, {
      status: 200,
      body: createExperimentDashboard({ id: "dash-1" }),
    });

    render(
      <Wrapper enabled={false}>
        <AutosaveIndicator />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "rename" }));
    await act(() => vi.advanceTimersByTimeAsync(1500));

    expect(spy.called).toBe(false);
    expect(screen.queryByText("autosave.saved")).not.toBeInTheDocument();
  });
});
