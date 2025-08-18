// @vitest-environment jsdom
// Add jest-dom import for custom matchers
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { vi, expect } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("renders and forwards ref", () => {
    const ref = vi.fn();
    render(<Input ref={ref as any} data-testid="input" />);
    expect(screen.getByTestId("input")).toBeInTheDocument();
    // forwardRef gets called with the DOM node once mounted
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
  });

  it("applies custom className and standard props", () => {
    render(
      <Input
        className="custom"
        placeholder="Enter text"
        type="email"
        disabled
        data-testid="input"
      />,
    );
    const el = screen.getByTestId("input");
    expect(el).toHaveClass("custom");
    expect(el).toHaveAttribute("placeholder", "Enter text");
    expect(el).toHaveAttribute("type", "email");
    expect(el).toBeDisabled();
  });

  describe("trim behavior", () => {
    it("does not trim by default, even after blur", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} data-testid="input" />);
      const input = screen.getByTestId("input");
      await user.type(input, "  hello  ");
      expect(input).toHaveValue("  hello  ");
      input.blur();
      expect(input).toHaveValue("  hello  ");
      // onChange should not be called with trimmed value
      const lastCall = handleChange.mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      if (lastCall) {
        expect(lastCall[0].target.value).toBe("  hello  ");
      }
    });

    it("trims leading/trailing but preserves internal spaces when trim is true, after blur", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input trim onChange={handleChange} data-testid="input" />);
      const input = screen.getByTestId("input");
      await user.type(input, "  hello  world   ");
      expect(input).toHaveValue("  hello  world   ");
      input.blur();
      expect(input).toHaveValue("hello  world"); // internal double space preserved
      // onChange should be called with trimmed value on blur
      const lastCall = handleChange.mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      if (lastCall) {
        expect(lastCall[0].target.value).toBe("hello  world");
      }
    });

    it("produces empty string when only spaces are typed and blurred", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input trim onChange={handleChange} data-testid="input" />);
      const input = screen.getByTestId("input");
      await user.type(input, "     ");
      expect(input).toHaveValue("     ");
      input.blur();
      expect(input).toHaveValue("");
      const lastCall = handleChange.mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      if (lastCall) {
        expect(lastCall[0].target.value).toBe("");
      }
    });

    it("works without onChange handler and trims on blur", async () => {
      const user = userEvent.setup();
      render(<Input trim data-testid="input" />);
      const input = screen.getByTestId("input");
      await user.type(input, "  hello  ");
      input.blur();
      expect(input).toHaveValue("hello");
    });
  });
});
