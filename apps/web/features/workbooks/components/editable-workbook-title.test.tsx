import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { EditableWorkbookTitle } from "./editable-workbook-title";

const RENAME = "workbooks.renameLabel";

describe("EditableWorkbookTitle", () => {
  it("renders a plain heading and no rename control when read-only", () => {
    render(<EditableWorkbookTitle name="My Workbook" onRename={vi.fn()} readOnly />);
    expect(screen.getByRole("heading", { name: "My Workbook" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RENAME })).not.toBeInTheDocument();
  });

  it("commits a trimmed new name on Enter", async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    render(<EditableWorkbookTitle name="Old" onRename={onRename} />);

    await user.click(screen.getByRole("button", { name: RENAME }));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "  New Name  {Enter}");

    expect(onRename).toHaveBeenCalledWith("New Name");
    expect(screen.getByRole("button", { name: RENAME })).toBeInTheDocument();
  });

  it("commits on blur", async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    render(<EditableWorkbookTitle name="Old" onRename={onRename} />);

    await user.click(screen.getByRole("button", { name: RENAME }));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Blurred");
    await user.tab();

    expect(onRename).toHaveBeenCalledWith("Blurred");
  });

  it("cancels on Escape without renaming", async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    render(<EditableWorkbookTitle name="Old" onRename={onRename} />);

    await user.click(screen.getByRole("button", { name: RENAME }));
    await user.type(screen.getByRole("textbox"), "Discarded{Escape}");

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: RENAME })).toBeInTheDocument();
  });

  it("does not rename when the value is unchanged or empty", async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    render(<EditableWorkbookTitle name="Same" onRename={onRename} />);

    await user.click(screen.getByRole("button", { name: RENAME }));
    await user.type(screen.getByRole("textbox"), "{Enter}"); // unchanged
    expect(onRename).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: RENAME }));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "{Enter}"); // empty
    expect(onRename).not.toHaveBeenCalled();
  });
});
