import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressForStorage } from "~/utils/storage-compression";

import {
  saveSuccessfulUpload,
  getSuccessfulUploadsWithKeys,
  removeSuccessfulUpload,
  clearSuccessfulUploads,
} from "../successful-uploads-storage";

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
  v4: () => "test-uuid-5678",
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

describe("successful-uploads-storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveSuccessfulUpload", () => {
    it("saves compressed upload to AsyncStorage", async () => {
      await saveSuccessfulUpload(mockUpload);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "SUCCESSFUL_UPLOAD_test-uuid-5678",
        compressForStorage(mockUpload),
      );
    });

    it("does not throw on storage error", async () => {
      vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("storage full"));

      await expect(saveSuccessfulUpload(mockUpload)).resolves.toBeUndefined();
    });
  });

  describe("getSuccessfulUploadsWithKeys", () => {
    it("returns parsed uploads filtered by prefix (compressed)", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
        "SUCCESSFUL_UPLOAD_abc",
        "FAILED_UPLOAD_xyz",
        "SUCCESSFUL_UPLOAD_def",
      ]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["SUCCESSFUL_UPLOAD_abc", compressForStorage(mockUpload)],
        ["SUCCESSFUL_UPLOAD_def", compressForStorage(mockUpload)],
      ]);

      const result = await getSuccessfulUploadsWithKeys();

      expect(result).toHaveLength(2);
      expect(result[0][0]).toBe("SUCCESSFUL_UPLOAD_abc");
      expect(result[0][1]).toEqual(mockUpload);
    });

    it("handles legacy uncompressed JSON entries", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["SUCCESSFUL_UPLOAD_abc"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["SUCCESSFUL_UPLOAD_abc", JSON.stringify(mockUpload)],
      ]);

      const result = await getSuccessfulUploadsWithKeys();

      expect(result).toHaveLength(1);
      expect(result[0][1]).toEqual(mockUpload);
    });

    it("skips entries with invalid data", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["SUCCESSFUL_UPLOAD_abc"]);
      vi.mocked(AsyncStorage.multiGet).mockResolvedValue([
        ["SUCCESSFUL_UPLOAD_abc", "not-valid-json"],
      ]);

      const result = await getSuccessfulUploadsWithKeys();
      expect(result).toHaveLength(0);
    });

    it("returns empty array on storage error", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockRejectedValueOnce(new Error("storage error"));

      const result = await getSuccessfulUploadsWithKeys();
      expect(result).toEqual([]);
    });
  });

  describe("removeSuccessfulUpload", () => {
    it("removes the item by key", async () => {
      await removeSuccessfulUpload("SUCCESSFUL_UPLOAD_abc");

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("SUCCESSFUL_UPLOAD_abc");
    });

    it("does not throw on storage error", async () => {
      vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error("remove error"));

      await expect(removeSuccessfulUpload("SUCCESSFUL_UPLOAD_abc")).resolves.toBeUndefined();
    });
  });

  describe("clearSuccessfulUploads", () => {
    it("removes only successful upload keys", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
        "SUCCESSFUL_UPLOAD_abc",
        "FAILED_UPLOAD_xyz",
        "SUCCESSFUL_UPLOAD_def",
      ]);

      await clearSuccessfulUploads();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        "SUCCESSFUL_UPLOAD_abc",
        "SUCCESSFUL_UPLOAD_def",
      ]);
    });

    it("does not throw on storage error", async () => {
      vi.mocked(AsyncStorage.getAllKeys).mockRejectedValueOnce(new Error("storage error"));

      await expect(clearSuccessfulUploads()).resolves.toBeUndefined();
    });
  });
});
