import { describe, expect, it } from "vitest";

import { zIotUploadUrlRequest } from "./iot.schema";

const experimentId = "94d8b584-2d27-46fa-aa6c-8908ce13d521";

describe("upload size declaration", () => {
  it("keeps the existing researcher request valid without a declaration", () => {
    expect(zIotUploadUrlRequest.parse({ experimentId })).toEqual({ experimentId });
  });
  it("carries a positive byte count without imposing the guest limit on researchers", () => {
    expect(zIotUploadUrlRequest.parse({ experimentId, contentLength: 2_000_000 })).toMatchObject({
      contentLength: 2_000_000,
    });
  });
  it.each([0, -1, 1.5])("refuses an invalid declared byte count %s", (contentLength) => {
    expect(zIotUploadUrlRequest.safeParse({ experimentId, contentLength }).success).toBe(false);
  });
});
