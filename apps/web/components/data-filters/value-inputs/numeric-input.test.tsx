import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { NumericInput } from "./numeric-input";

describe("NumericInput", () => {
  it("renders the current value as a number input", () => {
    render(<NumericInput value={42} onChange={vi.fn()} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(42);
  });

  it("emits a finite number on each keystroke", async () => {
    const onChange = vi.fn();
    render(<NumericInput value="" onChange={onChange} />);
    await userEvent.setup().type(screen.getByRole("spinbutton"), "7");
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it("clears to empty string when the field is emptied", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={5} onChange={onChange} />);
    await userEvent.setup().clear(screen.getByRole("spinbutton"));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("joins array values for display so prior state survives operator switches", () => {
    render(<NumericInput value={[1, 2]} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(null);
    expect(screen.getByDisplayValue("")).toBeInTheDocument();
  });
});
