import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { saveMeasurement } from "~/shared/db/measurements-storage";
import type { Measurement } from "~/shared/db/measurements-storage";

import { useMeasurements } from "./use-measurements";

vi.mock("~/features/auth/hooks/use-session", () => ({ useSession: () => ({ user: null }) }));

vi.mock("~/shared/db/measurements-storage", () => ({
  saveMeasurement: vi.fn(),
  UNSYNCED_STATUSES: ["pending", "failed"],
}));
vi.mock("~/shared/composition/upload", () => ({ getOutbox: vi.fn() }));

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
