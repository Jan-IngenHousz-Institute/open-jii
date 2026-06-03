import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDismissedAlertsStore } from "./dismissed-alerts-store";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(),
  },
}));

function resetStore() {
  useDismissedAlertsStore.setState({ dismissedIds: [] });
}

describe("useDismissedAlertsStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("starts with an empty dismissed list", () => {
    expect(useDismissedAlertsStore.getState().dismissedIds).toEqual([]);
  });

  it("adds an id on dismiss", () => {
    useDismissedAlertsStore.getState().dismiss("alert-1");
    expect(useDismissedAlertsStore.getState().dismissedIds).toContain("alert-1");
  });

  it("is idempotent — dismissing the same id twice does not duplicate it", () => {
    useDismissedAlertsStore.getState().dismiss("alert-1");
    useDismissedAlertsStore.getState().dismiss("alert-1");
    const { dismissedIds } = useDismissedAlertsStore.getState();
    expect(dismissedIds.filter((id) => id === "alert-1")).toHaveLength(1);
  });

  it("accumulates multiple distinct ids", () => {
    useDismissedAlertsStore.getState().dismiss("alert-1");
    useDismissedAlertsStore.getState().dismiss("alert-2");
    expect(useDismissedAlertsStore.getState().dismissedIds).toEqual(["alert-1", "alert-2"]);
  });
});
