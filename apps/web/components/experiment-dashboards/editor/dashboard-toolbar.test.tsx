import { createTableWidget } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { DashboardFormValues } from "../dashboard-form-shell";
import { DashboardEditorProvider, useDashboardEditor } from "./context/dashboard-editor-context";
import DashboardToolbar from "./dashboard-toolbar";

vi.mock("./inspector-toolbar/strips/table-widget-strip", () => ({
  TableWidgetStrip: () => <div data-testid="table-widget-strip" />,
}));
vi.mock("./inspector-toolbar/strips/table-data-strip", () => ({
  TableDataStrip: () => <div data-testid="table-data-strip" />,
}));
vi.mock("./inspector-toolbar/strips/visualization-strips-host", () => ({
  VisualizationStripsHost: () => null,
}));
vi.mock("./inspector-toolbar/strips/visualization-widget-strip", () => ({
  VisualizationWidgetStrip: () => null,
}));

const first = createTableWidget();
const second = createTableWidget();

function Harness({ children }: { children: ReactNode }) {
  const form = useForm<DashboardFormValues>({
    defaultValues: {
      name: "Dashboard",
      description: "",
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      widgets: [first, second],
    },
  });
  return (
    <FormProvider {...form}>
      <DashboardEditorProvider>{children}</DashboardEditorProvider>
    </FormProvider>
  );
}

function SelectButtons() {
  const { selectWidget } = useDashboardEditor();
  return (
    <>
      <button type="button" onClick={() => selectWidget(first.id)}>
        select first
      </button>
      <button type="button" onClick={() => selectWidget(second.id)}>
        select second
      </button>
    </>
  );
}

function renderToolbar() {
  return render(
    <Harness>
      <SelectButtons />
      <DashboardToolbar visible experimentId="exp-1" />
    </Harness>,
  );
}

describe("DashboardToolbar", () => {
  it("keeps the chosen section while the same widget stays selected", async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole("button", { name: "select first" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.tabs.data" }));
    await user.click(screen.getByRole("button", { name: "select first" }));

    expect(screen.getByRole("button", { name: "editor.inspector.tabs.data" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("table-data-strip")).toBeInTheDocument();
  });

  it("returns to the widget section when another widget is selected", async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole("button", { name: "select first" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.tabs.data" }));
    await user.click(screen.getByRole("button", { name: "select second" }));

    expect(screen.getByRole("button", { name: "editor.inspector.tabs.widget" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("table-widget-strip")).toBeInTheDocument();
  });
});
