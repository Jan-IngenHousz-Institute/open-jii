import type { AppStateStatus } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock react-native's AppState. We capture the listener registered by
// app-lifecycle so each test can drive transitions deterministically, and
// expose `currentState` because the module reads it at load time.
const appState = {
  currentState: "active" as AppStateStatus,
  handler: null as ((state: AppStateStatus) => void) | null,
  remove: vi.fn(),
};
const addEventListener = vi.fn((_event: string, handler: (state: AppStateStatus) => void) => {
  appState.handler = handler;
  return { remove: appState.remove };
});

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return appState.currentState;
    },
    addEventListener,
  },
}));

// Each test gets a fresh module so module-level `lastState` and the
// subscriber Set don't bleed across cases.
async function loadModule(initialState: AppStateStatus) {
  vi.resetModules();
  appState.currentState = initialState;
  appState.handler = null;
  addEventListener.mockClear();
  appState.remove.mockClear();
  return import("./app-lifecycle");
}

function fire(state: AppStateStatus) {
  if (!appState.handler) throw new Error("no AppState handler registered");
  appState.handler(state);
}

describe("app-lifecycle", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires listener on background → active", async () => {
    const { onAppForeground } = await loadModule("background");
    const listener = vi.fn();
    onAppForeground(listener);

    fire("active");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not fire on inactive → active (boot flap)", async () => {
    const { onAppForeground } = await loadModule("active");
    const listener = vi.fn();
    onAppForeground(listener);

    fire("inactive");
    fire("active");

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not fire on active → active (duplicate active events)", async () => {
    const { onAppForeground } = await loadModule("active");
    const listener = vi.fn();
    onAppForeground(listener);

    fire("active");

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not fire when leaving foreground", async () => {
    const { onAppForeground } = await loadModule("active");
    const listener = vi.fn();
    onAppForeground(listener);

    fire("background");
    fire("inactive");

    expect(listener).not.toHaveBeenCalled();
  });

  it("fans out a single foreground event to every subscriber", async () => {
    const { onAppForeground } = await loadModule("background");
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    onAppForeground(a);
    onAppForeground(b);
    onAppForeground(c);

    fire("active");

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it("registers exactly one native AppState listener regardless of subscriber count", async () => {
    const { onAppForeground } = await loadModule("background");
    onAppForeground(vi.fn());
    onAppForeground(vi.fn());
    onAppForeground(vi.fn());

    expect(addEventListener).toHaveBeenCalledTimes(1);
  });

  it("stops invoking a listener after unsubscribe", async () => {
    const { onAppForeground } = await loadModule("background");
    const listener = vi.fn();
    const unsubscribe = onAppForeground(listener);

    fire("active");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    fire("background");
    fire("active");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("removes the native AppState listener when the last subscriber unsubscribes", async () => {
    const { onAppForeground } = await loadModule("background");
    const unsubA = onAppForeground(vi.fn());
    const unsubB = onAppForeground(vi.fn());

    unsubA();
    expect(appState.remove).not.toHaveBeenCalled();

    unsubB();
    expect(appState.remove).toHaveBeenCalledTimes(1);
  });

  it("re-attaches a native listener after all subscribers have left", async () => {
    const { onAppForeground } = await loadModule("background");
    const unsub = onAppForeground(vi.fn());
    unsub();
    expect(appState.remove).toHaveBeenCalledTimes(1);

    onAppForeground(vi.fn());

    expect(addEventListener).toHaveBeenCalledTimes(2);
  });

  it("isolates listeners — a throwing subscriber does not block the others", async () => {
    const { onAppForeground } = await loadModule("background");
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    onAppForeground(bad);
    onAppForeground(good);

    fire("active");

    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("collapses rapid background → active flaps within the cooldown window", async () => {
    const { onAppForeground } = await loadModule("background");
    let now = 100_000;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    const listener = vi.fn();
    onAppForeground(listener);

    fire("active"); // genuine foreground — fires
    fire("background");
    fire("active"); // within 2s of the last fire — suppressed
    expect(listener).toHaveBeenCalledTimes(1);

    now += 2_001; // past COOLDOWN_MS
    fire("background");
    fire("active"); // cooldown elapsed — fires again
    expect(listener).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it("re-syncs transition state when the native listener is re-attached", async () => {
    // After the last subscriber leaves, the native listener detaches and
    // `lastState` freezes at "active". Without a re-sync on re-attach, the
    // next genuine background → active looks like active → active and is
    // wrongly filtered out.
    const { onAppForeground } = await loadModule("background");

    const first = vi.fn();
    const unsub = onAppForeground(first);
    fire("active"); // background → active fires
    expect(first).toHaveBeenCalledTimes(1);
    unsub(); // last subscriber gone → native listener removed

    // App drifts to the background while nothing is listening.
    appState.currentState = "background";

    const second = vi.fn();
    onAppForeground(second); // re-attach must re-sync lastState to "background"
    fire("active"); // must be seen as a real background → active

    expect(second).toHaveBeenCalledTimes(1);
  });
});
