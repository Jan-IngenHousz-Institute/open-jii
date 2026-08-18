import { createDeviceGroup } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotDeviceGroups } from "./useIotDeviceGroups";

describe("useIotDeviceGroups", () => {
  it("fetches the group list", async () => {
    server.mount(contract.deviceGroups.listDeviceGroups, {
      body: [createDeviceGroup(), createDeviceGroup()],
    });

    const { result } = renderHook(() => useIotDeviceGroups());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
  });

  it("surfaces an error response", async () => {
    server.mount(contract.deviceGroups.listDeviceGroups, { status: 500 });

    const { result } = renderHook(() => useIotDeviceGroups());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
