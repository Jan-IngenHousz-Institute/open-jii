import { createMarkdownCell, createQuestionCell } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { QuestionCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { Button } from "@repo/ui/components/button";

import { QuestionPicker } from "./question-picker";

function renderPicker(overrides: Partial<{ existingCells: WorkbookCell[] }> = {}) {
  const onSelect = vi.fn<(cell: QuestionCell) => void>();
  const existingCells = overrides.existingCells ?? [];
  return {
    onSelect,
    ...render(
      <QuestionPicker existingCells={existingCells} onSelect={onSelect}>
        <Button>Add question</Button>
      </QuestionPicker>,
    ),
  };
}

describe("QuestionPicker", () => {
  it("opens a popover with a name input when the trigger is clicked", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("button", { name: /add question/i }));

    expect(screen.getByRole("textbox", { name: /question name/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("shows the canonical column key as the user types", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("button", { name: /add question/i }));
    await user.type(screen.getByRole("textbox", { name: /question name/i }), "Plant Height (cm)");

    expect(screen.getByText(/column key:\s*plant_height_cm/i)).toBeInTheDocument();
  });

  it("creates a question cell with the typed name when the user clicks Create", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    await user.click(screen.getByRole("button", { name: /add question/i }));
    await user.type(screen.getByRole("textbox", { name: /question name/i }), "Soil moisture");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(onSelect).toHaveBeenCalledOnce();
    const created = onSelect.mock.calls[0][0];
    expect(created.type).toBe("question");
    expect(created.name).toBe("Soil moisture");
    expect(created.id).toBeDefined();
    expect(created.question).toMatchObject({ kind: "open_ended", text: "", required: false });
  });

  it("submits on Enter when the input is valid", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    await user.click(screen.getByRole("button", { name: /add question/i }));
    const input = screen.getByRole("textbox", { name: /question name/i });
    await user.type(input, "leaf_color{Enter}");

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0][0].name).toBe("leaf_color");
  });

  it("disables Create and surfaces an error when the canonical name collides with an existing question cell", async () => {
    const user = userEvent.setup();
    const existing = createQuestionCell({ id: "q-1", name: "soil_moisture" });
    const { onSelect } = renderPicker({ existingCells: [existing] });

    await user.click(screen.getByRole("button", { name: /add question/i }));
    // "Soil moisture" canonicalises to the same column key as the existing cell.
    await user.type(screen.getByRole("textbox", { name: /question name/i }), "Soil moisture");

    expect(screen.getByText(/already used by another question cell/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();

    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores collisions with non-question cells", async () => {
    const user = userEvent.setup();
    const markdown = createMarkdownCell({ id: "md-1", content: "any" });
    const { onSelect } = renderPicker({ existingCells: [markdown] });

    await user.click(screen.getByRole("button", { name: /add question/i }));
    await user.type(screen.getByRole("textbox", { name: /question name/i }), "Markdown");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("does not create the cell when the user cancels the popover", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    await user.click(screen.getByRole("button", { name: /add question/i }));
    await user.type(screen.getByRole("textbox", { name: /question name/i }), "Soil moisture");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
