import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressForStorage } from "~/utils/storage-compression";

import {
  saveFailedUpload,
  getFailedUploadsWithKeys,
  updateFailedUpload,
  removeFailedUpload,
  clearFailedUploads,
} from "../failed-uploads-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    getAllKeys: vi.fn(),
    multiGet: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

const mockUpload = {
  topic: "test/topic",
  measurementResult: { value: 42 },
  metadata: {
    experimentName: "Test Experiment",
    protocolName: "protocol-1",
    timestamp: "2026-03-02T10:00:00.000Z",
  },
};

describe("failed-uploads-storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveFailedUpload", () => {
    it("saves compressed upload to AsyncStorage", async () => {
      await saveFailedUpload(mockUpload);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "FAILED_UPLOAD_test-uuid-1234",
        compressForStorage(mockUpload),
      );
    });

    it("propagates AsyncStorage errors to the caller", async () => {
      const storageError = new Error("AsyncStorage is full");
      vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(storageError);

      await expect(saveFailedUpload(mockUpload)).rejects.toThrow("AsyncStorage is full");
    });
  });

  describe("getFailedUploadsWithKeys", () => {
    it("returns parsed uploads filtered by prefix (compressed)", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
        "FAILED_UPLOAD_abc",
        "SUCCESSFUL_UPLOAD_xyz",
        "FAILED_UPLOAD_def",
      ]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["FAILED_UPLOAD_abc", compressForStorage(mockUpload)],
        ["FAILED_UPLOAD_def", compressForStorage(mockUpload)],
      ]);

      const result = await getFailedUploadsWithKeys();

      expect(result).toHaveLength(2);
      expect(result[0][0]).toBe("FAILED_UPLOAD_abc");
      expect(result[0][1]).toEqual(mockUpload);
    });

    it("handles legacy uncompressed JSON entries", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["FAILED_UPLOAD_abc"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["FAILED_UPLOAD_abc", JSON.stringify(mockUpload)],
      ]);

      const result = await getFailedUploadsWithKeys();

      expect(result).toHaveLength(1);
      expect(result[0][1]).toEqual(mockUpload);
    });

    it("skips entries with invalid data", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["FAILED_UPLOAD_abc"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([["FAILED_UPLOAD_abc", "not-valid-json"]]);

      const result = await getFailedUploadsWithKeys();
      expect(result).toHaveLength(0);
    });

    it("returns empty array on storage error", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockRejectedValueOnce(new Error("storage error"));

      const result = await getFailedUploadsWithKeys();
      expect(result).toEqual([]);
    });
  });

  describe("updateFailedUpload", () => {
    it("stores compressed data for a valid key", async () => {
      const key = "FAILED_UPLOAD_abc";
      await updateFailedUpload(key, mockUpload);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, compressForStorage(mockUpload));
    });

    it("ignores keys without the correct prefix", async () => {
      await updateFailedUpload("WRONG_PREFIX_abc", mockUpload);

      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it("does not throw on storage error", async () => {
      vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("write error"));

      await expect(updateFailedUpload("FAILED_UPLOAD_abc", mockUpload)).resolves.toBeUndefined();
    });
  });

  describe("removeFailedUpload", () => {
    it("removes the item by key", async () => {
      await removeFailedUpload("FAILED_UPLOAD_abc");

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("FAILED_UPLOAD_abc");
    });

    it("does not throw on storage error", async () => {
      vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error("remove error"));

      await expect(removeFailedUpload("FAILED_UPLOAD_abc")).resolves.toBeUndefined();
    });
  });

  describe("clearFailedUploads", () => {
    it("removes only failed upload keys", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
        "FAILED_UPLOAD_abc",
        "SUCCESSFUL_UPLOAD_xyz",
        "FAILED_UPLOAD_def",
      ]);

      await clearFailedUploads();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        "FAILED_UPLOAD_abc",
        "FAILED_UPLOAD_def",
      ]);
    });

    it("does not throw on storage error", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockRejectedValueOnce(new Error("storage error"));

      await expect(clearFailedUploads()).resolves.toBeUndefined();
    });
  });
});
