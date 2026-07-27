import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeCommandWithDriver } from "~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution";
import { parseScalarReading } from "~/hooks/workbook/useLiveCapture/parse-scalar-reading";

import { MiniParDriver } from "@repo/iot";

import { MockTransportAdapter } from "./mock-devices";

/**
 * Integration test of the exact chain the workbook's live capture drives per
 * tick: MockTransportAdapter -> MiniParDriver -> executeCommandWithDriver
 * ("par") -> parseScalarReading. Proves a mock MiniPAR session produces
 * plottable, varying scalars without hardware.
 */
describe("live capture read path (mock MiniPAR)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("repeated `par` reads yield varying finite scalars", async () => {
    // Pin the noise term so only the deterministic sine drift remains.
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      const adapter = new MockTransportAdapter(1, "minipar");
      const driver = new MiniParDriver();
      driver.initialize(adapter);

      const readOnce = async () => {
        const reply = executeCommandWithDriver(driver, "par");
        // The mock replies after its 700ms wire delay.
        await vi.advanceTimersByTimeAsync(1000);
        return parseScalarReading(await reply);
      };

      const first = await readOnce();
      const second = await readOnce();

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(second).not.toBe(first);
      // Index 1 -> baseline 350, drifting at most ±15 (sine) ±2 (noise).
      expect(Math.abs((first ?? 0) - 350)).toBeLessThanOrEqual(17);
      expect(Math.abs((second ?? 0) - 350)).toBeLessThanOrEqual(17);

      await driver.destroy();
    } finally {
      randomSpy.mockRestore();
    }
  });
});
