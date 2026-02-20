import { describe, it, expect, vi } from "vitest";

import { delay, safeAsync } from "./async";

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

  describe("safeAsync", () => {
    it("should call the wrapped function with arguments", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const safe = safeAsync(fn);

      await safe("arg1", "arg2");
      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("should catch and log errors without throwing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      const error = new Error("test error");
      const fn = vi.fn().mockRejectedValue(error);
      const safe = safeAsync(fn);

      // Should NOT throw
      await expect(safe()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith("Async error:", error);

      consoleSpy.mockRestore();
    });

    it("should not log on success", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      const fn = vi.fn().mockResolvedValue("result");
      const safe = safeAsync(fn);

      await safe();
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
