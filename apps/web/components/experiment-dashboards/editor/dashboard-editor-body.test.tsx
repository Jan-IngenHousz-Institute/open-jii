import { server } from "@/test/msw/server";
import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import type { DashboardFormValues } from "../dashboard-form-shell";
import { DashboardEditorProvider } from "./context/dashboard-editor-context";
import { DashboardEditorBody } from "./dashboard-editor-body";

function setup() {
  server.mount(contract.experiments.getExperimentTables, { body: [] });
  return renderWithForm<DashboardFormValues>(
    () => (
      <DashboardEditorProvider>
        <DashboardEditorBody experimentId="exp-1" />
      </DashboardEditorProvider>
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Dash",
          description: "",
          layout: { columns: 12, rowHeight: 80, gap: 16 },
          widgets: [],
        },
      },
    },
  );
}

describe("DashboardEditorBody", () => {
  it("wraps the canvas in a LiveVizProvider and shows the empty-state hint", () => {
    setup();
    expect(screen.getByText("ui.messages.emptyDashboard")).toBeInTheDocument();
  });

  it("renders a positioned container so RGL has room to attach its observer", () => {
    const { container } = setup();
    const wrapper = container.querySelector("div.relative");
    expect(wrapper).toBeInTheDocument();
  });
});
