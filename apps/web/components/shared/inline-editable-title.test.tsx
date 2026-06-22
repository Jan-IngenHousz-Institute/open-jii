import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { InlineEditableTitle } from "./inline-editable-title";

describe("InlineEditableTitle", () => {
  const defaultProps = {
    name: "My Title",
    onSave: vi.fn().mockResolvedValue(undefined),
    hasAccess: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title in display mode", () => {
    render(<InlineEditableTitle {...defaultProps} />);
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("does not enter edit mode when hasAccess is false", async () => {
    const user = userEvent.setup();
    render(<InlineEditableTitle {...defaultProps} hasAccess={false} />);

    await user.click(screen.getByText("My Title"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("enters edit mode on click when hasAccess is true", async () => {
    const user = userEvent.setup();
    render(<InlineEditableTitle {...defaultProps} />);

    await user.click(screen.getByText("My Title"));
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("My Title");
  });

  it("cancels editing when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<InlineEditableTitle {...defaultProps} />);

    await user.click(screen.getByText("My Title"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("calls onSave when value changes and save is clicked", async () => {
    const user = userEvent.setup();
    render(<InlineEditableTitle {...defaultProps} />);

    await user.click(screen.getByText("My Title"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "New Title");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(defaultProps.onSave).toHaveBeenCalledWith("New Title");
  });

  it("does not call onSave when value is unchanged", async () => {
    const user = userEvent.setup();
    render(<InlineEditableTitle {...defaultProps} />);

    await user.click(screen.getByText("My Title"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("does not call onSave when value is empty", async () => {
    const user = userEvent.setup();
    render(<InlineEditableTitle {...defaultProps} />);

    await user.click(screen.getByText("My Title"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("shows pencil icon only when hasAccess is true", () => {
    const { rerender } = render(<InlineEditableTitle {...defaultProps} hasAccess={false} />);
    expect(
      screen.getByText("My Title").parentElement?.querySelector("svg"),
    ).not.toBeInTheDocument();

    rerender(<InlineEditableTitle {...defaultProps} hasAccess={true} />);
    expect(screen.getByText("My Title").parentElement?.querySelector("svg")).toBeInTheDocument();
  });

  it("renders badges and actions when provided", () => {
    render(
      <InlineEditableTitle
        {...defaultProps}
        badges={<span data-testid="badge">Badge</span>}
        actions={<button data-testid="action">Action</button>}
      />,
    );
    expect(screen.getByTestId("badge")).toBeInTheDocument();
    expect(screen.getByTestId("action")).toBeInTheDocument();
  });

  it("commits the new value when the user presses Enter", async () => {
    const user = userEvent.setup();
    render(<InlineEditableTitle {...defaultProps} />);

    await user.click(screen.getByText("My Title"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Renamed via Enter");
    await user.keyboard("{Enter}");

    expect(defaultProps.onSave).toHaveBeenCalledWith("Renamed via Enter");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("cancels the edit when the user presses Escape", async () => {
    const user = userEvent.setup();
    render(<InlineEditableTitle {...defaultProps} />);

    await user.click(screen.getByText("My Title"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Discarded");
    await user.keyboard("{Escape}");

    expect(defaultProps.onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });
});
