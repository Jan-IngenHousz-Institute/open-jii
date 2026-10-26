import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormColorInput } from "../form-color-input";

function hexInput() {
  return screen.getByRole("textbox");
}

describe("FormColorInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the draft at once and commits it after the debounce", () => {
    const onCommit = vi.fn();
    render(<FormColorInput value="#111111" fallback="#000000" onCommit={onCommit} />);

    fireEvent.change(hexInput(), { target: { value: "#222222" } });
    expect(hexInput()).toHaveValue("#222222");
    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("#222222");
  });

  it("re-seeds from an outside value change and drops the pending commit", () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <FormColorInput value="#111111" fallback="#000000" onCommit={onCommit} />,
    );

    fireEvent.change(hexInput(), { target: { value: "#222222" } });
    rerender(<FormColorInput value="#333333" fallback="#000000" onCommit={onCommit} />);

    expect(hexInput()).toHaveValue("#333333");
    vi.advanceTimersByTime(150);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("falls back when the value is cleared from outside", () => {
    const { rerender } = render(
      <FormColorInput value="#111111" fallback="#000000" onCommit={vi.fn()} />,
    );

    rerender(<FormColorInput value={undefined} fallback="#000000" onCommit={vi.fn()} />);

    expect(hexInput()).toHaveValue("#000000");
  });

  it("keeps the draft across a re-render that changes neither value nor fallback", () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <FormColorInput value="#111111" fallback="#000000" onCommit={onCommit} />,
    );

    fireEvent.change(hexInput(), { target: { value: "#222222" } });
    rerender(
      <FormColorInput value="#111111" fallback="#000000" onCommit={onCommit} className="x" />,
    );

    expect(hexInput()).toHaveValue("#222222");
    vi.advanceTimersByTime(150);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("#222222");
  });
});
