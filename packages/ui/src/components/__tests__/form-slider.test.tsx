import { fireEvent, render, screen } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { FormSlider } from "../form-slider";

function Harness(props: Omit<React.ComponentProps<typeof FormSlider>, "label"> & { label?: string }) {
  const form = useForm();
  return (
    <FormProvider {...form}>
      <FormSlider label="Width" {...props} />
    </FormProvider>
  );
}

describe("FormSlider", () => {
  it("renders the label and the formatted badge value", () => {
    render(
      <Harness
        value={5}
        fallback={1}
        min={0}
        max={10}
        step={1}
        onCommit={vi.fn()}
        formatBadge={(v) => `${v}px`}
      />,
    );
    expect(screen.getByText("Width")).toBeDefined();
    expect(screen.getByText("5px")).toBeDefined();
  });

  it("falls back to `fallback` when value is undefined", () => {
    render(
      <Harness
        value={undefined}
        fallback={7}
        min={0}
        max={10}
        step={1}
        onCommit={vi.fn()}
        formatBadge={(v) => `${v}`}
      />,
    );
    expect(screen.getByText("7")).toBeDefined();
  });

  it("re-seeds local state when the external value changes", () => {
    const { rerender } = render(
      <Harness
        value={2}
        fallback={0}
        min={0}
        max={10}
        step={1}
        onCommit={vi.fn()}
        formatBadge={(v) => `${v}`}
      />,
    );
    expect(screen.getByText("2")).toBeDefined();
    rerender(
      <Harness
        value={8}
        fallback={0}
        min={0}
        max={10}
        step={1}
        onCommit={vi.fn()}
        formatBadge={(v) => `${v}`}
      />,
    );
    expect(screen.getByText("8")).toBeDefined();
  });

  it("forwards onCommit when the slider value is committed", () => {
    const onCommit = vi.fn();
    render(
      <Harness
        value={3}
        fallback={0}
        min={0}
        max={10}
        step={1}
        onCommit={onCommit}
        formatBadge={(v) => `${v}`}
      />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenCalled();
  });
});
