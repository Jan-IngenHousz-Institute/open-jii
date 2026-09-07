import { act, renderHook } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { useCalibrationOperator } from "./useCalibrationOperator";

describe("useCalibrationOperator", () => {
  it("surfaces an acknowledge request and settles it from the screen", async () => {
    const { result } = renderHook(() => useCalibrationOperator());

    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = result.current.port.acknowledge("Install the dark fixture", "DARK");
    });

    expect(result.current.pending).toMatchObject({
      kind: "acknowledge",
      prompt: "Install the dark fixture",
      confirm: "DARK",
    });

    act(() => {
      const pending = result.current.pending;
      if (pending?.kind === "acknowledge") pending.resolve(true);
    });

    await expect(answer).resolves.toBe(true);
    expect(result.current.pending).toBeNull();
  });

  it("surfaces a value request and hands the typed value back", async () => {
    const { result } = renderHook(() => useCalibrationOperator());

    let answer: Promise<number | string> | undefined;
    act(() => {
      answer = result.current.port.readValue("Enter the reference reading", "number");
    });

    expect(result.current.pending).toMatchObject({ kind: "readValue", type: "number" });

    act(() => {
      const pending = result.current.pending;
      if (pending?.kind === "readValue") pending.resolve(176.4);
    });

    await expect(answer).resolves.toBe(176.4);
  });

  // Leaving the wizard must not leave the interpreter awaiting forever.
  it("declines an open request when cancelled", async () => {
    const { result } = renderHook(() => useCalibrationOperator());

    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = result.current.port.acknowledge("Expose the sensor");
    });

    act(() => {
      result.current.cancel();
    });

    await expect(answer).resolves.toBe(false);
    expect(result.current.pending).toBeNull();
  });
});
