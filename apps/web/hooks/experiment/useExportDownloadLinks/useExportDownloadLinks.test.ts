import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExportDownloadLinks } from "./useExportDownloadLinks";

const links = {
  parts: [
    {
      index: 0,
      fileName: "trial_raw-data_20261019_133841.csv.gz",
      sizeBytes: 900,
      url: "https://exports.s3.test/part-00000.csv.gz?X-Amz-Signature=a",
    },
  ],
  expiresAt: "2026-10-19T13:53:41.000Z",
};

describe("useExportDownloadLinks", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches the signed links of one export", async () => {
    const spy = server.mount(contract.experiments.getExportDownloadLinks, { body: links });

    const { result } = renderHook(() =>
      useExportDownloadLinks({ experimentId: "exp-1", exportId: "export-1" }),
    );

    await waitFor(() => expect(result.current.data).toEqual(links));
    expect(spy.params).toEqual({ id: "exp-1", exportId: "export-1" });
  });

  it("fetches fresh links before the old ones stop working", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = server.mount(contract.experiments.getExportDownloadLinks, { body: links });

    const { result } = renderHook(() =>
      useExportDownloadLinks({ experimentId: "exp-1", exportId: "export-1" }),
    );
    await waitFor(() => expect(result.current.data).toEqual(links));

    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    await waitFor(() => expect(spy.callCount).toBe(2));
  });
});
