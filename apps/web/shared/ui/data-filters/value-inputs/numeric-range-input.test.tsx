import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { NumericRangeInput } from "./numeric-range-input";

describe("NumericRangeInput", () => {
  it("shows two number inputs labelled by from/to placeholders", () => {
    render(<NumericRangeInput value={["", ""]} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("dataFilters.rangeFrom")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("dataFilters.rangeTo")).toBeInTheDocument();
  });

  it("renders both bounds when value is a tuple", () => {
    render(<NumericRangeInput value={[1, 9]} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("dataFilters.rangeFrom")).toHaveValue(1);
    expect(screen.getByPlaceholderText("dataFilters.rangeTo")).toHaveValue(9);
  });

  it("falls back to empty bounds when value isn't an array", () => {
    render(<NumericRangeInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("dataFilters.rangeFrom")).toHaveValue(null);
    expect(screen.getByPlaceholderText("dataFilters.rangeTo")).toHaveValue(null);
  });

  it("emits the lower bound as a number, keeping the upper bound intact", async () => {
    const onChange = vi.fn();
    render(<NumericRangeInput value={["", 10]} onChange={onChange} />);
    await userEvent.setup().type(screen.getByPlaceholderText("dataFilters.rangeFrom"), "3");
    expect(onChange).toHaveBeenLastCalledWith([3, 10]);
  });

  it("emits an empty string when a bound is cleared", async () => {
    const onChange = vi.fn();
    render(<NumericRangeInput value={[2, 10]} onChange={onChange} />);
    await userEvent.setup().clear(screen.getByPlaceholderText("dataFilters.rangeFrom"));
    expect(onChange).toHaveBeenLastCalledWith(["", 10]);
  });
});
