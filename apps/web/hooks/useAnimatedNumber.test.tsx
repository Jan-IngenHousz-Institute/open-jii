import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { useAnimatedNumber } from "./useAnimatedNumber";

interface Props {
  value: number;
  subject?: string;
}

function renderCount(initialProps: Props) {
  return renderHook(({ value, subject }: Props) => useAnimatedNumber(value, subject), {
    initialProps,
  });
}

describe("useAnimatedNumber", () => {
  it("shows the first value as it is", () => {
    const { result } = renderCount({ value: 120 });

    expect(result.current).toBe(120);
  });

  it("counts from the old value and settles on the new one", async () => {
    const { result, rerender } = renderCount({ value: 100 });

    rerender({ value: 200 });

    expect(result.current).toBe(100);
    await waitFor(() => expect(result.current).toBe(200));
  });

  it("shows a count filling in from zero as it is", () => {
    const { result, rerender } = renderCount({ value: 0 });

    rerender({ value: 50 });

    expect(result.current).toBe(50);
  });

  it("jumps straight to a new subject's value", () => {
    const { result, rerender } = renderCount({ value: 100, subject: "raw_data" });

    rerender({ value: 7, subject: "macro-1" });

    expect(result.current).toBe(7);
  });
});
