import { describe, it, expect, vi } from "vitest";

import { delay } from "./async";

describe("async utilities", () => {
  describe("delay", () => {
    it("should resolve after specified milliseconds", async () => {
      vi.useFakeTimers();

      const promise = delay(100);
      vi.advanceTimersByTime(100);
      await promise;

      vi.useRealTimers();
    });

    it("should wait the correct duration", async () => {
      vi.useFakeTimers();

      let resolved = false;
      const promise = delay(500).then(() => {
        resolved = true;
      });

      vi.advanceTimersByTime(499);
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(1);
      await promise;
      expect(resolved).toBe(true);

      vi.useRealTimers();
    });
  });
});
