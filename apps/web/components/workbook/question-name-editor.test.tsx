import { createMarkdownCell, createQuestionCell } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { Button } from "@repo/ui/components/button";

import { QuestionNameEditor } from "./question-name-editor";

function renderEditor(
  overrides: Partial<{
    initialName: string;
    cellId: string;
    existingCells: WorkbookCell[];
    onRename: (n: string) => void;
  }> = {},
) {
  const onRename = overrides.onRename ?? vi.fn();
  return {
    onRename,
    ...render(
      <QuestionNameEditor
        initialName={overrides.initialName ?? "soil_moisture"}
        cellId={overrides.cellId ?? "q-1"}
        existingCells={overrides.existingCells ?? []}
        onRename={onRename}
      >
        <Button>{overrides.initialName ?? "soil_moisture"}</Button>
      </QuestionNameEditor>,
    ),
  };
}

describe("QuestionNameEditor", () => {
  it("opens with the current name pre-filled in the input", async () => {
    const user = userEvent.setup();
    renderEditor({ initialName: "soil_moisture" });

    await user.click(screen.getByRole("button", { name: /soil_moisture/i }));

    expect(screen.getByRole("textbox", { name: /question name/i })).toHaveValue("soil_moisture");
  });

  it("renames the cell when the user submits a new valid name", async () => {
    const user = userEvent.setup();
    const { onRename } = renderEditor({ initialName: "soil_moisture" });

    await user.click(screen.getByRole("button", { name: /soil_moisture/i }));
    const input = screen.getByRole("textbox", { name: /question name/i });
    await user.clear(input);
    await user.type(input, "leaf_color");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onRename).toHaveBeenCalledOnce();
    expect(onRename).toHaveBeenCalledWith("leaf_color");
  });

  it("submits on Enter when the name is valid and changed", async () => {
    const user = userEvent.setup();
    const { onRename } = renderEditor({ initialName: "old" });

    await user.click(screen.getByRole("button", { name: /old/i }));
    const input = screen.getByRole("textbox", { name: /question name/i });
    await user.clear(input);
    await user.type(input, "new{Enter}");

    expect(onRename).toHaveBeenCalledWith("new");
  });

  it("does not fire onRename when the user closes without changing the name", async () => {
    const user = userEvent.setup();
    const { onRename } = renderEditor({ initialName: "soil_moisture" });

    await user.click(screen.getByRole("button", { name: /soil_moisture/i }));
    // Input still equals initialName.
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onRename).not.toHaveBeenCalled();
  });

  it("blocks save and surfaces an error when the new name collides with another question cell", async () => {
    const user = userEvent.setup();
    const other = createQuestionCell({ id: "q-other", name: "leaf_color" });
    const { onRename } = renderEditor({
      initialName: "soil_moisture",
      cellId: "q-1",
      existingCells: [other],
    });

    await user.click(screen.getByRole("button", { name: /soil_moisture/i }));
    const input = screen.getByRole("textbox", { name: /question name/i });
    await user.clear(input);
    await user.type(input, "Leaf Color");

    expect(screen.getByText(/already used by another question cell/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();

    await user.keyboard("{Enter}");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("excludes the cell being renamed from the duplicate check", async () => {
    const user = userEvent.setup();
    const self = createQuestionCell({ id: "q-1", name: "soil_moisture" });
    const { onRename } = renderEditor({
      initialName: "soil_moisture",
      cellId: "q-1",
      // The cell shows up in existingCells; the editor must skip its own id.
      existingCells: [self],
    });

    await user.click(screen.getByRole("button", { name: /soil_moisture/i }));
    const input = screen.getByRole("textbox", { name: /question name/i });
    await user.clear(input);
    await user.type(input, "Soil Moisture");
    // Canonical "soil_moisture" matches self → still allowed.
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onRename).toHaveBeenCalledWith("Soil Moisture");
  });

  it("ignores collisions with non-question cells", async () => {
    const user = userEvent.setup();
    const md = createMarkdownCell({ id: "md-1", content: "" });
    const { onRename } = renderEditor({
      initialName: "old",
      existingCells: [md],
    });

    await user.click(screen.getByRole("button", { name: /old/i }));
    const input = screen.getByRole("textbox", { name: /question name/i });
    await user.clear(input);
    await user.type(input, "Markdown");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onRename).toHaveBeenCalledWith("Markdown");
  });
});
