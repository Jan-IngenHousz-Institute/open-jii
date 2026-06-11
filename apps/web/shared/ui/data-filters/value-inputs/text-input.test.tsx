import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { TextInput } from "./text-input";

describe("TextInput", () => {
  it("renders the supplied placeholder and current value", () => {
    render(<TextInput value="hello" onChange={vi.fn()} placeholder="ph" />);
    const input = screen.getByPlaceholderText("ph");
    expect(input).toHaveValue("hello");
  });

  it("emits each keystroke through onChange", async () => {
    const onChange = vi.fn();
    render(<TextInput value="" onChange={onChange} placeholder="ph" />);
    await userEvent.setup().type(screen.getByPlaceholderText("ph"), "ab");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("b");
  });

  it("joins array values with comma+space for display", () => {
    render(<TextInput value={["x", "y"]} onChange={vi.fn()} placeholder="ph" />);
    expect(screen.getByPlaceholderText("ph")).toHaveValue("x, y");
  });
});
