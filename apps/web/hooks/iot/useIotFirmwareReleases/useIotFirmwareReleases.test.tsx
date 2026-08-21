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

  it("stays put while disabled", async () => {
    const spy = server.mount(contract.iot.listIotFirmwareReleases, {
      body: { releases: [RELEASE] },
    });

    const { result } = renderHook(() => useIotFirmwareReleases("ambyte", { enabled: false }));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(spy.called).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("does not retry a family whose repository is not configured", async () => {
    const spy = server.mount(contract.iot.listIotFirmwareReleases, { status: 404 });

    const { result } = renderHook(() => useIotFirmwareReleases("minipar"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // A configuration gap is settled on the first answer.
    expect(spy.calls).toHaveLength(1);
  });

  it("surfaces a failure", async () => {
    server.mount(contract.iot.listIotFirmwareReleases, { status: 500 });

    const { result } = renderHook(() => useIotFirmwareReleases("ambyte"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
