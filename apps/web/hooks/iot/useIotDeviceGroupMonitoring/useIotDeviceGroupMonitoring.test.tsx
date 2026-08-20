import { createDeviceGroupMemberHealth } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotDeviceGroupMonitoring } from "./useIotDeviceGroupMonitoring";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const RANGE = {
  from: "2026-08-17T00:00:00.000Z",
  to: "2026-08-18T00:00:00.000Z",
  bucket: "hour",
} as const;

describe("useIotDeviceGroupMonitoring", () => {
  it("queries the group window and returns its health facts", async () => {
    const member = createDeviceGroupMemberHealth({ name: "Gateway" });
    const spy = server.mount(contract.iot.getIotDeviceGroupMonitoring, {
      body: { members: [member], throughput: [], events: [], pipelineUnavailable: false },
    });

    const { result } = renderHook(() => useIotDeviceGroupMonitoring(GROUP_ID, RANGE));

    await waitFor(() => {
      expect(result.current.data?.members).toEqual([member]);
    });
    expect(spy.calls[0].query).toMatchObject({ from: RANGE.from, to: RANGE.to, bucket: "hour" });
  });

  it("surfaces a failure", async () => {
    server.mount(contract.iot.getIotDeviceGroupMonitoring, { status: 500 });

    const { result } = renderHook(() => useIotDeviceGroupMonitoring(GROUP_ID, RANGE));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
