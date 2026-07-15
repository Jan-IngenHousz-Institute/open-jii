import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotDevice } from "./useIotDevice";

describe("useIotDevice", () => {
  it("fetches a single device by id", async () => {
    const spy = server.mount(contract.iot.getIotDevice, {
      body: createIotDevice({ id: "dev-1" }),
    });

    const { result } = renderHook(() => useIotDevice("dev-1"));

    await waitFor(() => {
      expect(result.current.data?.id).toBe("dev-1");
    });
    expect(spy.params.deviceId).toBe("dev-1");
  });

  it("surfaces a not-found error", async () => {
    server.mount(contract.iot.getIotDevice, { status: 404 });

    const { result } = renderHook(() => useIotDevice("missing"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
