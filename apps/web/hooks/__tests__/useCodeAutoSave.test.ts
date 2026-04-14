import { renderHook, act } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { toast } from "@repo/ui/hooks";

import { useCodeAutoSave } from "../useCodeAutoSave";

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown): { message: string } | undefined => {
    if (typeof err === "object" && err !== null && "body" in err) {
      return (err as { body: { message: string } }).body;
    }
    return undefined;
  },
}));

const defaultOptions = {
  saveFn: vi.fn(),
  buildPayload: (code: string) => ({ code }),
  toKey: (code: string) => code,
};

function renderAutoSave(overrides: Partial<typeof defaultOptions> = {}) {
  return renderHook(() =>
    useCodeAutoSave<string, { code: string }>({
      ...defaultOptions,
      ...overrides,
    }),
  );
}

describe("useCodeAutoSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("startEditing", () => {
    it("sets isEditing to true and editedCode to initial value with synced status", () => {
      const { result } = renderAutoSave();

      expect(result.current.isEditing).toBe(false);

      act(() => {
        result.current.startEditing("initial code");
      });

      expect(result.current.isEditing).toBe(true);
      expect(result.current.editedCode).toBe("initial code");
      expect(result.current.syncStatus).toBe("synced");
    });
  });

  describe("handleChange", () => {
    it("sets syncStatus to unsynced and calls saveFn after delay with buildPayload result", () => {
      const saveFn = vi.fn();
      const { result } = renderAutoSave({ saveFn });

      act(() => {
        result.current.startEditing("original");
      });

      act(() => {
        result.current.handleChange("modified");
      });

      expect(result.current.syncStatus).toBe("unsynced");
      expect(result.current.editedCode).toBe("modified");
      expect(saveFn).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.syncStatus).toBe("syncing");
      expect(saveFn).toHaveBeenCalledWith(
        { code: "modified" },
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          onSuccess: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          onError: expect.any(Function),
        }),
      );
    });

    it("stays synced and does not call saveFn when value is same as saved", () => {
      const saveFn = vi.fn();
      const { result } = renderAutoSave({ saveFn });

      act(() => {
        result.current.startEditing("same");
      });

      act(() => {
        result.current.handleChange("same");
      });

      expect(result.current.syncStatus).toBe("synced");

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(saveFn).not.toHaveBeenCalled();
    });

    it("early returns without saving when isValid returns false", () => {
      const saveFn = vi.fn();
      const { result } = renderHook(() =>
        useCodeAutoSave<string, { code: string }>({
          saveFn,
          buildPayload: (code: string) => ({ code }),
          toKey: (code: string) => code,
          isValid: (value: string) => value !== "invalid",
        }),
      );

      act(() => {
        result.current.startEditing("original");
      });

      act(() => {
        result.current.handleChange("invalid");
      });

      // editedCode is still set
      expect(result.current.editedCode).toBe("invalid");
      // but syncStatus should not have changed to unsynced
      expect(result.current.syncStatus).toBe("synced");

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(saveFn).not.toHaveBeenCalled();
    });
  });


  describe("debounced save callbacks", () => {
    it("transitions syncing -> synced on onSuccess and updates savedKey", () => {
      const saveFn = vi.fn();
      const { result } = renderAutoSave({ saveFn });

      act(() => {
        result.current.startEditing("original");
      });

      act(() => {
        result.current.handleChange("updated");
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.syncStatus).toBe("syncing");

      // Simulate onSuccess callback
      act(() => {
        const call = saveFn.mock.calls[0] as [{ code: string }, { onSuccess: () => void }];
        call[1].onSuccess();
      });

      expect(result.current.syncStatus).toBe("synced");

      // Verify savedKey was updated: changing to same value should stay synced
      act(() => {
        result.current.handleChange("updated");
      });

      expect(result.current.syncStatus).toBe("synced");
    });

    it("shows destructive toast and reverts to unsynced on onError", () => {
      const saveFn = vi.fn();
      const { result } = renderAutoSave({ saveFn });

      act(() => {
        result.current.startEditing("original");
      });

      act(() => {
        result.current.handleChange("will-fail");
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.syncStatus).toBe("syncing");

      // Simulate onError callback
      const apiError = { body: { message: "Save failed" } };
      act(() => {
        const call = saveFn.mock.calls[0] as [
          { code: string },
          { onError: (err: unknown) => void },
        ];
        call[1].onError(apiError);
      });

      expect(result.current.syncStatus).toBe("unsynced");
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        description: "Save failed",
        variant: "destructive",
      });
    });
  });

  describe("closeEditing", () => {
    it("calls saveFn immediately when there are unsaved changes", () => {
      const saveFn = vi.fn();
      const { result } = renderAutoSave({ saveFn });

      act(() => {
        result.current.startEditing("original");
      });

      act(() => {
        result.current.handleChange("changed");
      });

      // Close without waiting for debounce
      act(() => {
        result.current.closeEditing();
      });

      expect(saveFn).toHaveBeenCalledWith({ code: "changed" });
      expect(result.current.isEditing).toBe(false);
    });

    it("does not call saveFn when there are no changes", () => {
      const saveFn = vi.fn();
      const { result } = renderAutoSave({ saveFn });

      act(() => {
        result.current.startEditing("original");
      });

      act(() => {
        result.current.closeEditing();
      });

      expect(saveFn).not.toHaveBeenCalled();
      expect(result.current.isEditing).toBe(false);
    });

    it("does not call saveFn when value is invalid", () => {
      const saveFn = vi.fn();
      const { result } = renderHook(() =>
        useCodeAutoSave<string, { code: string }>({
          saveFn,
          buildPayload: (code: string) => ({ code }),
          toKey: (code: string) => code,
          isValid: (value: string) => value !== "bad-value",
        }),
      );

      act(() => {
        result.current.startEditing("original");
      });

      // Directly set editedCode to an invalid value via handleChange
      act(() => {
        result.current.handleChange("bad-value");
      });

      act(() => {
        result.current.closeEditing();
      });

      expect(saveFn).not.toHaveBeenCalled();
      expect(result.current.isEditing).toBe(false);
    });
  });


  describe("cleanup on unmount", () => {
    it("clears pending timeout on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      const { result, unmount } = renderAutoSave();

      act(() => {
        result.current.startEditing("original");
      });

      act(() => {
        result.current.handleChange("modified");
      });

      // There should be a pending timeout now
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
