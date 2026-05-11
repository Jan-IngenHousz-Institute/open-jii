import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePythonRuntimeStore } from "./python-runtime-store";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(() => Promise.resolve()),
    getItem: vi.fn(() => Promise.resolve(null)),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

describe("python-runtime-store", () => {
  beforeEach(() => {
    usePythonRuntimeStore.getState().reset();
  });

  it("defaults to absent with zero progress and no error", () => {
    const state = usePythonRuntimeStore.getState();
    expect(state.state).toBe("absent");
    expect(state.progress).toBe(0);
    expect(state.error).toBeUndefined();
  });

  it("transitions absent -> installing -> ready and tracks progress", () => {
    const store = usePythonRuntimeStore.getState();

    store.setState("installing");
    store.setProgress(0.25);
    expect(usePythonRuntimeStore.getState().state).toBe("installing");
    expect(usePythonRuntimeStore.getState().progress).toBe(0.25);

    store.setProgress(1);
    store.setState("ready");
    expect(usePythonRuntimeStore.getState().state).toBe("ready");
    expect(usePythonRuntimeStore.getState().progress).toBe(1);
  });

  it("captures error on failure and exposes it for the UI", () => {
    const store = usePythonRuntimeStore.getState();

    store.setState("installing");
    store.setError("network unreachable");
    store.setState("failed");

    const current = usePythonRuntimeStore.getState();
    expect(current.state).toBe("failed");
    expect(current.error).toBe("network unreachable");
  });

  it("reset clears state, progress and error", () => {
    const store = usePythonRuntimeStore.getState();
    store.setState("failed");
    store.setProgress(0.4);
    store.setError("boom");

    store.reset();

    const current = usePythonRuntimeStore.getState();
    expect(current.state).toBe("absent");
    expect(current.progress).toBe(0);
    expect(current.error).toBeUndefined();
  });
});
