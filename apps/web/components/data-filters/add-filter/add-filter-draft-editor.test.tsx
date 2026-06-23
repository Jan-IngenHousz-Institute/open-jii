import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn, ExperimentDataFilter } from "@repo/api/domains/experiment/experiment.schema";

import { AddFilterDraftEditor } from "./add-filter-draft-editor";

const stringColumn: ExperimentDataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };

function mountDistinct() {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

interface RenderOptions {
  draft?: ExperimentDataFilter;
  onBack?: () => void;
  onCancel?: () => void;
  onApply?: () => void;
}

function renderEditor({
  draft = { column: "label", operator: "equals", value: "hello" },
  onBack = vi.fn(),
  onCancel = vi.fn(),
  onApply = vi.fn(),
}: RenderOptions = {}) {
  return renderWithForm<ExperimentDataFilter>(
    () => (
      <AddFilterDraftEditor
        column={stringColumn}
        experimentId="exp-1"
        tableName="raw_data"
        onBack={onBack}
        onCancel={onCancel}
        onApply={onApply}
      />
    ),
    { useFormProps: { defaultValues: draft, mode: "onChange" } },
  );
}

describe("AddFilterDraftEditor", () => {
  it("renders the column name in the back affordance", () => {
    mountDistinct();
    renderEditor();
    expect(screen.getByRole("button", { name: /label/ })).toBeInTheDocument();
  });

  it("disables apply when the draft has an empty value", async () => {
    mountDistinct();
    const { form } = renderEditor({
      draft: { column: "label", operator: "equals", value: "" },
    });
    await form.trigger();
    expect(screen.getByRole("button", { name: "dataFilters.apply" })).toBeDisabled();
  });

  it("invokes onApply when apply is clicked on a complete draft", async () => {
    mountDistinct();
    const onApply = vi.fn();
    const { form } = renderEditor({ onApply });
    await form.trigger();
    await userEvent.setup().click(screen.getByRole("button", { name: "dataFilters.apply" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("invokes onCancel when cancel is clicked", async () => {
    mountDistinct();
    const onCancel = vi.fn();
    renderEditor({ onCancel });
    await userEvent.setup().click(screen.getByRole("button", { name: "dataFilters.cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("invokes onBack from the back affordance", async () => {
    mountDistinct();
    const onBack = vi.fn();
    renderEditor({ onBack });
    await userEvent.setup().click(screen.getByRole("button", { name: /label/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
