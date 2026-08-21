import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useDeviceFirmwareHistory } from "./useDeviceFirmwareHistory";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const RANGE = {
  from: "2026-07-15T00:00:00.000Z",
  to: "2026-08-14T00:00:00.000Z",
  bucket: "day" as const,
};

describe("useDeviceFirmwareHistory", () => {
  it("reads the reported versions for the range", async () => {
    const spy = server.mount(contract.iot.getDeviceFirmwareHistory, {
      body: {
        versions: [
          {
            version: "1.3.0",
            firstSeen: "2026-08-01T00:00:00.000Z",
            lastSeen: "2026-08-14T00:00:00.000Z",
            count: 5,
          },
        ],
      },
    });

    const { result } = renderHook(() => useDeviceFirmwareHistory(DEVICE_ID, RANGE));

    await waitFor(() => {
      expect(result.current.data?.versions).toHaveLength(1);
    });
    expect(spy.params.deviceId).toBe(DEVICE_ID);
    expect(spy.calls[0].query.bucket).toBe("day");
  });

  it("surfaces a failure", async () => {
    server.mount(contract.iot.getDeviceFirmwareHistory, { status: 500 });

    const { result } = renderHook(() => useDeviceFirmwareHistory(DEVICE_ID, RANGE));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
