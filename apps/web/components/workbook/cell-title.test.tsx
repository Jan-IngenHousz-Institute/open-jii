import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { CellTitle } from "./cell-title";

const labels = { rename: "Rename", save: "Save name", cancel: "Cancel" };

describe("CellTitle", () => {
  it("renders plain text with no controls when rename is not allowed", () => {
    render(<CellTitle name="My Protocol" canRename={false} onRename={vi.fn()} labels={labels} />);
    expect(screen.getByText("My Protocol")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rename")).not.toBeInTheDocument();
  });

  it("commits a trimmed new name on save", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CellTitle name="Old" canRename onRename={onRename} labels={labels} />);

    await user.click(screen.getByLabelText("Rename"));
    await user.clear(screen.getByLabelText("Rename"));
    await user.type(screen.getByLabelText("Rename"), "  New name  ");
    await user.click(screen.getByLabelText("Save name"));

    expect(onRename).toHaveBeenCalledWith("New name");
  });

  it("does not call onRename when the name is unchanged or empty", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CellTitle name="Same" canRename onRename={onRename} labels={labels} />);

    await user.click(screen.getByLabelText("Rename"));
    await user.click(screen.getByLabelText("Save name"));
    expect(onRename).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Rename"));
    await user.clear(screen.getByLabelText("Rename"));
    await user.click(screen.getByLabelText("Save name"));
    expect(onRename).not.toHaveBeenCalled();
  });

  it("commits the new name on Enter", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CellTitle name="Old" canRename onRename={onRename} labels={labels} />);

    await user.click(screen.getByLabelText("Rename"));
    await user.clear(screen.getByLabelText("Rename"));
    await user.type(screen.getByLabelText("Rename"), "Via Enter{Enter}");

    await waitFor(() => expect(onRename).toHaveBeenCalledWith("Via Enter"));
  });

  it("cancels editing via the cancel button", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CellTitle name="Keep" canRename onRename={onRename} labels={labels} />);

    await user.click(screen.getByLabelText("Rename"));
    await user.type(screen.getByLabelText("Rename"), "discarded");
    await user.click(screen.getByLabelText("Cancel"));

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText("Keep")).toBeInTheDocument();
  });

  it("cancels editing on Escape without saving", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CellTitle name="Keep" canRename onRename={onRename} labels={labels} />);

    await user.click(screen.getByLabelText("Rename"));
    await user.type(screen.getByLabelText("Rename"), "discarded");
    await user.keyboard("{Escape}");

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText("Keep")).toBeInTheDocument();
  });

  it("keeps the editor open when onRename rejects", async () => {
    const onRename = vi.fn().mockRejectedValue(new Error("taken"));
    const user = userEvent.setup();
    render(<CellTitle name="Old" canRename onRename={onRename} labels={labels} />);

    await user.click(screen.getByLabelText("Rename"));
    await user.clear(screen.getByLabelText("Rename"));
    await user.type(screen.getByLabelText("Rename"), "New");
    await user.click(screen.getByLabelText("Save name"));

    await waitFor(() => expect(onRename).toHaveBeenCalled());
    expect(screen.getByLabelText("Save name")).toBeInTheDocument();
  });
});
