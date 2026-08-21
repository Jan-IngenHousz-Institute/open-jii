import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotFirmwareReleases } from "./useIotFirmwareReleases";

const RELEASE = {
  version: "v1.3.0",
  name: null,
  publishedAt: "2026-08-01T10:00:00.000Z",
  prerelease: false,
  latest: true,
  notes: null,
  releaseUrl: "https://github.com/org/repo/releases/tag/v1.3.0",
  assets: [],
};

describe("useIotFirmwareReleases", () => {
  it("reads the family's releases", async () => {
    const spy = server.mount(contract.iot.listIotFirmwareReleases, {
      body: { releases: [RELEASE] },
    });

    const { result } = renderHook(() => useIotFirmwareReleases("ambyte"));

    await waitFor(() => {
      expect(result.current.data?.releases).toHaveLength(1);
    });
    expect(spy.params.family).toBe("ambyte");
  });

  it("surfaces a failure", async () => {
    server.mount(contract.iot.listIotFirmwareReleases, { status: 500 });

    const { result } = renderHook(() => useIotFirmwareReleases("ambyte"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
