import { createUpload } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useListUploads } from "./useListUploads";

// The ts-rest contract still carries the stale `/uploads` path; the live
// backend (and the oRPC contract the hook now uses) serve `/data/uploads`.
const listUploadsEndpoint = {
  ...contract.experiments.listUploads,
  path: "/api/v1/experiments/:id/data/uploads",
};

describe("useListUploads", () => {
  it("returns the upload list when enabled", async () => {
    const uploads = [
      createUpload({ uploadId: "u1", status: "running" }),
      createUpload({ uploadId: "u2", status: "completed" }),
    ];
    server.mount(listUploadsEndpoint, { body: { uploads } });

    const { result } = renderHook(() => useListUploads("exp-1", { enabled: true }));

    await waitFor(() => {
      expect(result.current.data?.uploads).toHaveLength(2);
    });
    expect(result.current.data?.uploads[0].uploadId).toBe("u1");
  });

  it("does not fetch when disabled", () => {
    const spy = server.mount(listUploadsEndpoint, { body: { uploads: [] } });

    const { result } = renderHook(() => useListUploads("exp-1", { enabled: false }));

    // No request should be sent; data stays undefined.
    expect(result.current.data).toBeUndefined();
    expect(spy.callCount).toBe(0);
  });

  it("forwards the uploadTableName filter to the request", async () => {
    const spy = server.mount(listUploadsEndpoint, { body: { uploads: [] } });

    renderHook(() => useListUploads("exp-1", { uploadTableName: "leaf_traits", enabled: true }));

    await waitFor(() => {
      expect(spy.callCount).toBeGreaterThanOrEqual(1);
    });
    expect(spy.calls[0].query.uploadTableName).toBe("leaf_traits");
  });
});
