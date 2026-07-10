import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotDevices } from "./useIotDevices";

describe("useIotDevices", () => {
  it("fetches the owner's devices", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [createIotDevice(), createIotDevice()],
    });

    const { result } = renderHook(() => useIotDevices());

    await waitFor(() => {
      expect(result.current.data?.body).toHaveLength(2);
    });
  });

  it("surfaces an error response", async () => {
    server.mount(contract.iot.listIotDevices, { status: 401 });

    const { result } = renderHook(() => useIotDevices());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
