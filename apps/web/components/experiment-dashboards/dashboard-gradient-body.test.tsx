import { createDashboardLayout } from "@/test/factories";
import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DashboardFormValues } from "./dashboard-form-shell";
import { DashboardGradientBody } from "./dashboard-gradient-body";
import { DashboardEditorProvider } from "./editor/context/dashboard-editor-context";

// Editor canvas pieces are decorative for this surface; replace them with
// trivial placeholders so we can isolate gradient-body's own behaviour.
vi.mock("./editor/canvas/grid-backdrop", () => ({
  GridBackdrop: () => <div data-testid="grid-backdrop" />,
}));
vi.mock("./editor/canvas/widget-placement-ghost", () => ({
  WidgetPlacementGhost: () => <div data-testid="placement-ghost" />,
}));
vi.mock("./editor/dashboard-modebar", () => ({
  DashboardModebar: () => <div data-testid="dashboard-modebar" />,
}));
vi.mock("./editor/dashboard-toolbar", () => ({
  default: () => <div data-testid="dashboard-toolbar" />,
}));
// Bounds depend on layout measurement which jsdom can't reliably do; pin to null.
vi.mock("./editor/hooks/use-backdrop-bounds", () => ({
  useBackdropBounds: () => null,
}));

function defaults(): DashboardFormValues {
  return {
    name: "x",
    description: "",
    layout: createDashboardLayout(),
    widgets: [],
  };
}

function setup(isEditing: boolean, children: React.ReactNode = <span />) {
  return renderWithForm<DashboardFormValues>(
    () => (
      <DashboardEditorProvider>
        <DashboardGradientBody experimentId="exp-1" isEditing={isEditing}>
          {children}
        </DashboardGradientBody>
      </DashboardEditorProvider>
    ),
    { useFormProps: { defaultValues: defaults() } },
  );
}

describe("DashboardGradientBody", () => {
  it("renders its children inside the gradient frame", () => {
    setup(false, <span data-testid="child">canvas</span>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("always mounts modebar, toolbar, and placement ghost so each can drive its own animation", () => {
    setup(true);
    expect(screen.getByTestId("dashboard-modebar")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("placement-ghost")).toBeInTheDocument();
  });

  it("does not render the grid backdrop when not editing (even if bounds existed)", () => {
    setup(false);
    expect(screen.queryByTestId("grid-backdrop")).toBeNull();
  });

  it("does not render the grid backdrop when isEditing but bounds are unmeasured", () => {
    setup(true);
    expect(screen.queryByTestId("grid-backdrop")).toBeNull();
  });
});
