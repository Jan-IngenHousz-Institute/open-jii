import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render } from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

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

function Wrapper({ children }: { children: ReactNode }) {
  const form = useForm<DashboardFormValues>({ defaultValues: defaults() });
  return (
    <AutosaveStatusProvider>
      <FormProvider {...form}>
        <Inner form={form}>{children}</Inner>
      </FormProvider>
    </AutosaveStatusProvider>
  );
}

function Inner({
  form,
  children,
}: {
  form: ReturnType<typeof useForm<DashboardFormValues>>;
  children: ReactNode;
}) {
  useDashboardAutosave({ form, experimentId: "exp-1", dashboardId: "dash-1" });
  return <>{children}</>;
}

describe("useDashboardAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts without firing a save on the initial form value", () => {
    const spy = server.mount(orpcContract.experiments.updateExperimentDashboard, {
      status: 200,
      body: createExperimentDashboard({ id: "dash-1" }),
    });

    render(<Wrapper>{null}</Wrapper>);
    expect(spy.called).toBe(false);
  });
});
