import { fireEvent, render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { CommaSeparatedInput } from "./comma-separated-input";

describe("CommaSeparatedInput", () => {
  it("renders an array value as a comma-separated string", () => {
    render(<CommaSeparatedInput value={["a", "b"]} onChange={vi.fn()} kind="categorical" />);
    expect(screen.getByPlaceholderText("dataFilters.placeholderCommaSeparated")).toHaveValue(
      "a, b",
    );
  });

  it("splits user input and trims whitespace", () => {
    const onChange = vi.fn();
    render(<CommaSeparatedInput value={[]} onChange={onChange} kind="categorical" />);
    fireEvent.change(screen.getByPlaceholderText("dataFilters.placeholderCommaSeparated"), {
      target: { value: "foo, bar ,baz" },
    });
    expect(onChange).toHaveBeenLastCalledWith(["foo", "bar", "baz"]);
  });

  it("converts numeric-looking entries to numbers when kind is numeric", () => {
    const onChange = vi.fn();
    render(<CommaSeparatedInput value={[]} onChange={onChange} kind="numeric" />);
    fireEvent.change(screen.getByPlaceholderText("dataFilters.placeholderCommaSeparated"), {
      target: { value: "1,2.5,foo" },
    });
    expect(onChange).toHaveBeenLastCalledWith([1, 2.5, "foo"]);
  });

  it("drops empty entries", () => {
    const onChange = vi.fn();
    render(<CommaSeparatedInput value={[]} onChange={onChange} kind="categorical" />);
    fireEvent.change(screen.getByPlaceholderText("dataFilters.placeholderCommaSeparated"), {
      target: { value: "a,,b," },
    });
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
  });
});
