import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AddCellButton } from "./add-cell-button";

vi.mock("./macro-picker", () => ({
  MacroPicker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./protocol-picker", () => ({
  ProtocolPicker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("AddCellButton", () => {
  const onAdd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all cell type buttons in bottom variant", () => {
    render(<AddCellButton onAdd={onAdd} variant="bottom" />);
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.getByText("Protocol")).toBeInTheDocument();
    expect(screen.getByText("Macro")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Branch")).toBeInTheDocument();
  });

  it("hides branch when showBranch is false", () => {
    render(<AddCellButton onAdd={onAdd} variant="bottom" showBranch={false} />);
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.queryByText("Branch")).not.toBeInTheDocument();
  });

  it("calls onAdd for markdown type", async () => {
    const user = userEvent.setup();
    render(<AddCellButton onAdd={onAdd} variant="bottom" />);
    await user.click(screen.getByText("Markdown"));
    expect(onAdd).toHaveBeenCalledWith("markdown");
  });

  it("calls onAdd for question type", async () => {
    const user = userEvent.setup();
    render(<AddCellButton onAdd={onAdd} variant="bottom" />);
    await user.click(screen.getByText("Question"));
    expect(onAdd).toHaveBeenCalledWith("question");
  });

  it("calls onAdd for branch type", async () => {
    const user = userEvent.setup();
    render(<AddCellButton onAdd={onAdd} variant="bottom" />);
    await user.click(screen.getByText("Branch"));
    expect(onAdd).toHaveBeenCalledWith("branch");
  });

  it("shows empty state when showEmptyState is true", () => {
    render(<AddCellButton onAdd={onAdd} variant="bottom" showEmptyState />);
    expect(screen.getByText("Empty workbook")).toBeInTheDocument();
    expect(screen.getByText("Add a cell to get started")).toBeInTheDocument();
  });
});
