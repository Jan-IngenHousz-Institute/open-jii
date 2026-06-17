import { renderWithForm, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { DashboardFormValues } from "../dashboard-form-shell";
import { DashboardEditorProvider } from "./context/dashboard-editor-context";
import { DashboardModebar } from "./dashboard-modebar";

function setup(visible: boolean) {
  return renderWithForm<DashboardFormValues>(
    () => (
      <DashboardEditorProvider>
        <DashboardModebar visible={visible} />
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

describe("DashboardModebar", () => {
  it("renders cursor and placement tools", () => {
    setup(true);
    expect(screen.getByLabelText("editor.modebar.cursor")).toBeInTheDocument();
    expect(screen.getByLabelText("editor.widgetTypes.visualization")).toBeInTheDocument();
    expect(screen.getByLabelText("editor.widgetTypes.richText")).toBeInTheDocument();
    expect(screen.getByLabelText("editor.widgetTypes.table")).toBeInTheDocument();
    expect(screen.getByLabelText("editor.widgetTypes.filter")).toBeInTheDocument();
  });

  it("marks the cursor as pressed by default and pressed-state flips when a placement tool is picked", async () => {
    setup(true);
    const cursor = screen.getByLabelText("editor.modebar.cursor");
    expect(cursor).toHaveAttribute("aria-pressed", "true");

    const chartButton = screen.getByLabelText("editor.widgetTypes.visualization");
    await userEvent.click(chartButton);
    expect(chartButton).toHaveAttribute("aria-pressed", "true");
    expect(cursor).toHaveAttribute("aria-pressed", "false");
  });

  it("exposes aria-hidden=true on the shell when visible=false", () => {
    // Scope the query to this render's container so leftover DOM from a prior
    // test (under `isolate: false`) can't match an earlier shell.
    const { container } = setup(false);
    const shell = container.querySelector("[data-editor-chrome]");
    expect(shell).not.toBeNull();
    expect(shell).toHaveAttribute("aria-hidden", "true");
  });
});
