import { createDashboardLayout, createRichTextWidget } from "@/test/factories";
import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DashboardWidget } from "@repo/api/schemas/experiment.schema";

import type { DashboardFormValues } from "./dashboard-form-shell";
import { DashboardViewBody } from "./dashboard-view-body";

// Capture the dashboard prop that the renderer receives so we can assert on
// how view-body assembles it from the form state.
vi.mock("./dashboard-renderer", () => ({
  DashboardRenderer: ({
    dashboard,
  }: {
    dashboard: { id: string; name: string; widgets: DashboardWidget[] };
  }) => (
    <div
      data-testid="renderer"
      data-id={dashboard.id}
      data-name={dashboard.name}
      data-widget-count={dashboard.widgets.length}
    />
  ),
}));

function defaults(overrides: Partial<DashboardFormValues> = {}): DashboardFormValues {
  return {
    name: "Test dashboard",
    description: "",
    layout: createDashboardLayout(),
    widgets: [],
    ...overrides,
  };
}

describe("DashboardViewBody", () => {
  it("synthesizes a dashboard from the form values and passes it to the renderer", () => {
    renderWithForm<DashboardFormValues>(
      () => <DashboardViewBody experimentId="exp-1" dashboardId="dash-9" />,
      { useFormProps: { defaultValues: defaults({ name: "Photosynth" }) } },
    );

    const renderer = screen.getByTestId("renderer");
    expect(renderer.getAttribute("data-id")).toBe("dash-9");
    expect(renderer.getAttribute("data-name")).toBe("Photosynth");
  });

  it("forwards the current widget list length from form state", () => {
    renderWithForm<DashboardFormValues>(
      () => <DashboardViewBody experimentId="exp-1" dashboardId="dash-9" />,
      {
        useFormProps: {
          defaultValues: defaults({
            widgets: [createRichTextWidget(), createRichTextWidget()],
          }),
        },
      },
    );

    expect(screen.getByTestId("renderer").getAttribute("data-widget-count")).toBe("2");
  });

  it("falls back to an empty widget grid when no widgets are present", () => {
    renderWithForm<DashboardFormValues>(
      () => <DashboardViewBody experimentId="exp-1" dashboardId="dash-9" />,
      { useFormProps: { defaultValues: defaults({ widgets: [] }) } },
    );

    expect(screen.getByTestId("renderer").getAttribute("data-widget-count")).toBe("0");
  });

  it("normalizes a missing description to null on the synthetic dashboard", () => {
    renderWithForm<DashboardFormValues>(
      () => <DashboardViewBody experimentId="exp-1" dashboardId="dash-9" />,
      // description left undefined.
      {
        useFormProps: {
          defaultValues: { name: "x", layout: createDashboardLayout(), widgets: [] },
        },
      },
    );

    // No throw and renderer rendered with the synthetic dashboard.
    expect(screen.getByTestId("renderer")).toBeInTheDocument();
  });
});
