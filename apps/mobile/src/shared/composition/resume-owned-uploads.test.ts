import { beforeEach, describe, expect, it, vi } from "vitest";

import { resumeOwnedUploads } from "./resume-owned-uploads";

const { getMeasurementIds, getLocalUploadIdentity, enqueueMany } = vi.hoisted(() => ({
  getMeasurementIds: vi.fn(),
  getLocalUploadIdentity: vi.fn(),
  enqueueMany: vi.fn(),
}));
vi.mock("~/shared/db/measurements-storage", () => ({
  getMeasurementIds,
  UNSYNCED_STATUSES: ["pending", "failed"],
}));
vi.mock("~/features/auth/services/local-upload-identity", () => ({ getLocalUploadIdentity }));
vi.mock("./upload", () => ({ getOutbox: () => ({ enqueueMany }) }));

beforeEach(() => {
  vi.clearAllMocks();
  getMeasurementIds.mockResolvedValue(["held-row"]);
});

describe("resumeOwnedUploads", () => {
  it("leaves held rows unchanged when the local storage read fails", async () => {
    getMeasurementIds.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(resumeOwnedUploads("owner")).resolves.toBeUndefined();
    expect(enqueueMany).not.toHaveBeenCalled();
  });
  it("requeues held rows when the owner's local session is ready", async () => {
    getLocalUploadIdentity.mockReturnValue({ userId: "owner", isGuest: true });
    await resumeOwnedUploads("owner");
    expect(getMeasurementIds).toHaveBeenCalledWith(["pending", "failed"]);
    expect(enqueueMany).toHaveBeenCalledExactlyOnceWith(["held-row"]);
  });

  it.each([null, { userId: "another", isGuest: false }])(
    "holds work if identity disappeared or changed during the storage read (%s)",
    async (identity) => {
      getLocalUploadIdentity.mockReturnValue(identity);
      await resumeOwnedUploads("owner");
      expect(enqueueMany).not.toHaveBeenCalled();
    },
  );
});
