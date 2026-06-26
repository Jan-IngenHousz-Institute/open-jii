import { createRichTextWidget } from "@/test/factories";
import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import { RichTextWidgetEditor } from "./rich-text-widget-editor";

function renderEditor(opts: { html: string; isSelected: boolean }): { html: () => string } {
  const widget = createRichTextWidget({ config: { html: opts.html } });
  let currentValues: DashboardFormValues = {
    name: "Dashboard",
    description: "",
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    widgets: [widget],
  };
  renderWithForm<DashboardFormValues>(
    (form) => {
      currentValues = form.watch();
      return <RichTextWidgetEditor widget={widget} widgetIndex={0} isSelected={opts.isSelected} />;
    },
    { useFormProps: { defaultValues: currentValues } },
  );
  return {
    html: () => {
      const w = currentValues.widgets[0];
      return w.type === "richText" ? w.config.html : "";
    },
  };
}

describe("RichTextWidgetEditor", () => {
  it("renders the editable textarea when the widget is selected", () => {
    renderEditor({ html: "<p>hi</p>", isSelected: true });
    expect(
      screen.getByRole("textbox", { name: "editor.richTextConfig.placeholder" }),
    ).toBeInTheDocument();
  });

  it("includes Quill's formatting toolbar in the editable state", () => {
    renderEditor({ html: "", isSelected: true });
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bold" })).toBeInTheDocument();
  });

  it("shows the empty editor hint when not selected and the content is empty", () => {
    renderEditor({ html: "<p><br></p>", isSelected: false });
    expect(screen.getByText("editor.richTextConfig.emptyHint")).toBeInTheDocument();
  });

  it("renders the html preview when not selected and content is present", () => {
    renderEditor({ html: "<p>read only</p>", isSelected: false });
    expect(screen.getByText("read only")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
