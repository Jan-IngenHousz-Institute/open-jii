import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveMeasurement } from "~/shared/db/measurements-storage";
import type { Measurement } from "~/shared/db/measurements-storage";

import { useMeasurements } from "./use-measurements";

const { storage, enqueue, enqueueMany } = vi.hoisted(() => ({
  storage: {
    saveMeasurement: vi.fn(),
    getMeasurement: vi.fn(),
    getMeasurementIds: vi.fn(),
    removeMeasurement: vi.fn(),
    removeMeasurements: vi.fn(),
    updateMeasurement: vi.fn(),
    markAsFailed: vi.fn(),
  },
  enqueue: vi.fn(),
  enqueueMany: vi.fn(),
}));
vi.mock("~/features/auth/hooks/use-session", () => ({
  useSession: () => ({ user: { id: "guest-a", isAnonymous: true } }),
}));
vi.mock("~/shared/db/measurements-storage", () => ({
  ...storage,
  UNSYNCED_STATUSES: ["pending", "failed"],
}));
vi.mock("~/shared/composition/upload", () => ({ getOutbox: () => ({ enqueue, enqueueMany }) }));
beforeEach(() => {
  vi.clearAllMocks();
  storage.getMeasurementIds.mockResolvedValue([]);
});

function mountActions() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useMeasurements(), { wrapper }), client };
}
const viewer = { userId: "guest-a", isGuest: true };

describe("capture owner persistence", () => {
  it.each([true, false, null])(
    "keeps the capture identity separate from the payload, guest=%s",
    async (isGuest) => {
      const client = new QueryClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      vi.mocked(saveMeasurement).mockResolvedValue("capture-row");
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result, unmount } = renderHook(() => useMeasurements(), { wrapper });
      const measurement: Measurement = {
        topic: "measurement",
        measurementResult: { value: 1 },
        metadata: {
          experimentName: "Demo",
          protocolName: "Demo",
          timestamp: "2026-10-30T00:00:00Z",
        },
      };
      const owner = { userId: "capture-owner", isGuest };
      await act(async () => {
        expect(await result.current.saveMeasurement(measurement, "pending", owner)).toBe(
          "capture-row",
        );
      });
      expect(saveMeasurement).toHaveBeenLastCalledWith(measurement, "pending", owner);
      expect(invalidate).toHaveBeenCalledTimes(1);
      unmount();
      client.clear();
    },
  );
});

describe("owner-scoped measurement actions", () => {
  it("uploads only visible rows, including the bulk upload path", async () => {
    const { result, unmount, client } = mountActions();
    storage.getMeasurement.mockImplementation((key: string) =>
      Promise.resolve(key === "own" ? { topic: "own" } : null),
    );
    storage.getMeasurementIds.mockResolvedValue(["own"]);
    await act(async () => {
      await result.current.uploadOne("foreign");
      await result.current.uploadOne("own");
      await result.current.uploadMany(["foreign", "own"]);
      await result.current.uploadAll();
    });
    expect(storage.getMeasurement).toHaveBeenCalledWith("foreign", viewer);
    expect(storage.getMeasurement).toHaveBeenCalledWith("own", viewer);
    expect(enqueue).toHaveBeenCalledExactlyOnceWith("own");
    expect(enqueueMany.mock.calls).toEqual([[["own"]], [["own"]]]);
    expect(storage.getMeasurementIds).toHaveBeenCalledWith(["pending", "failed"], viewer);
    unmount();
    client.clear();
  });
  it("scopes deletion, synced cleanup and comment updates to the active owner", async () => {
    const { result, unmount, client } = mountActions();
    storage.getMeasurementIds.mockResolvedValue(["synced-own"]);
    const measurement: Measurement = {
      topic: "own",
      measurementResult: { value: 1 },
      metadata: { experimentName: "Demo", protocolName: "Demo", timestamp: "2026-10-30T00:00:00Z" },
    };
    await act(async () => {
      await result.current.removeMeasurement("own");
      await result.current.removeMeasurements(["own", "foreign"]);
      await result.current.clearSyncedMeasurements();
      await result.current.updateMeasurementComment("own", measurement, "Synthetic plot");
    });
    expect(storage.removeMeasurement).toHaveBeenCalledWith("own", viewer);
    expect(storage.removeMeasurements).toHaveBeenCalledWith(["own", "foreign"], viewer);
    expect(storage.getMeasurementIds).toHaveBeenCalledWith(["successful"], viewer);
    expect(storage.removeMeasurements).toHaveBeenCalledWith(["synced-own"], viewer);
    expect(storage.updateMeasurement).toHaveBeenCalledWith(
      "own",
      expect.objectContaining({ topic: "own" }),
      viewer,
    );
    unmount();
    client.clear();
  });
  it("skips empty bulk actions", async () => {
    const { result, unmount, client } = mountActions();
    await act(async () => {
      await result.current.uploadMany([]);
      await result.current.removeMeasurements([]);
    });
    expect(storage.getMeasurement).not.toHaveBeenCalled();
    expect(storage.removeMeasurements).not.toHaveBeenCalled();
    expect(enqueueMany).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });
});
