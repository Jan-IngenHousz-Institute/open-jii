import { describe, expect, it } from "vitest";

import {
  validateAmbyteStructure,
  isExcludedFile,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  EXCLUDED_FILES,
} from "./data-upload-validation";

// Helper to create mock FileList
const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index],
  } as FileList;
  for (let i = 0; i < files.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (fileList as any)[i] = files[i];
  }
  return fileList;
};

describe("data-upload-validation", () => {
  describe("isExcludedFile", () => {
    it("should exclude .DS_Store files", () => {
      const file = new File(["content"], ".DS_Store", { type: "text/plain" });
      expect(isExcludedFile(file)).toBe(true);
    });

    it("should exclude files in paths containing excluded files", () => {
      const file = new File(["content"], "data.txt", { type: "text/plain" });
      (file as { webkitRelativePath?: string }).webkitRelativePath = "folder/.DS_Store/data.txt";
      expect(isExcludedFile(file)).toBe(true);
    });

    it("should not exclude valid files", () => {
      const file = new File(["content"], "data.txt", { type: "text/plain" });
      (file as { webkitRelativePath?: string }).webkitRelativePath = "folder/data.txt";
      expect(isExcludedFile(file)).toBe(false);
    });
  });

  describe("validateAmbyteStructure", () => {
    it("should return error for empty file list", () => {
      const files = createMockFileList([]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({ key: "uploadModal.validation.noFiles" });
    });

    it("should return error for no folder structure", () => {
      const file = new File(["content"], "data.txt", { type: "text/plain" });
      const files = createMockFileList([file]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({ key: "uploadModal.validation.selectFolder" });
    });

    it("should validate correct Ambyte folder structure at root level", () => {
      const file = new File(["content"], "data.txt", { type: "text/plain" });
      (file as { webkitRelativePath?: string }).webkitRelativePath = "Ambyte_1/data.txt";
      const files = createMockFileList([file]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate correct Ambyte folder structure with subdirectories", () => {
      const file = new File(["content"], "data.txt", { type: "text/plain" });
      (file as { webkitRelativePath?: string }).webkitRelativePath = "parent/Ambyte_2/data.txt";
      const files = createMockFileList([file]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return error for invalid folder structure", () => {
      const file = new File(["content"], "data.txt", { type: "text/plain" });
      (file as { webkitRelativePath?: string }).webkitRelativePath = "invalid/data.txt";
      const files = createMockFileList([file]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({ key: "uploadModal.validation.invalidStructure" });
    });

    it("should return error for oversized files", () => {
      const file = new File(["large content"], "data.txt", { type: "text/plain" });
      Object.defineProperty(file, "size", { value: MAX_FILE_SIZE + 1 });
      (file as { webkitRelativePath?: string }).webkitRelativePath = "Ambyte_1/data.txt";
      const files = createMockFileList([file]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        key: "uploadModal.validation.fileSizeExceeded",
        options: { count: 1 },
      });
    });

    it("should return error for unsupported file extensions", () => {
      const file = new File(["content"], "data.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      (file as { webkitRelativePath?: string }).webkitRelativePath = "Ambyte_1/data.docx";
      const files = createMockFileList([file]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        key: "uploadModal.validation.unsupportedExtensions",
        options: {
          count: 1,
          extensions: ALLOWED_EXTENSIONS.join(", "),
        },
      });
    });

    it("should ignore excluded files during validation", () => {
      const validFile = new File(["content"], "data.txt", { type: "text/plain" });
      (validFile as { webkitRelativePath?: string }).webkitRelativePath = "Ambyte_1/data.txt";

      const excludedFile = new File(["content"], ".DS_Store", { type: "text/plain" });
      (excludedFile as { webkitRelativePath?: string }).webkitRelativePath = "Ambyte_1/.DS_Store";

      const files = createMockFileList([validFile, excludedFile]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return multiple errors when multiple issues exist", () => {
      const oversizedFile = new File(["large content"], "data.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      Object.defineProperty(oversizedFile, "size", { value: MAX_FILE_SIZE + 1 });
      (oversizedFile as { webkitRelativePath?: string }).webkitRelativePath = "invalid/data.docx";

      const files = createMockFileList([oversizedFile]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContainEqual({ key: "uploadModal.validation.invalidStructure" });
      expect(result.errors).toContainEqual({
        key: "uploadModal.validation.fileSizeExceeded",
        options: { count: 1 },
      });
      expect(result.errors).toContainEqual({
        key: "uploadModal.validation.unsupportedExtensions",
        options: {
          count: 1,
          extensions: ALLOWED_EXTENSIONS.join(", "),
        },
      });
    });

    it("should validate structure with nested Ambyte subdirectories", () => {
      const file = new File(["content"], "data.txt", { type: "text/plain" });
      (file as { webkitRelativePath?: string }).webkitRelativePath = "experiment/Ambyte_3/data.txt";
      const files = createMockFileList([file]);
      const result = validateAmbyteStructure(files);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle multiple root folders with mixed valid/invalid structure", () => {
      const validFile1 = new File(["content"], "data1.txt", { type: "text/plain" });
      (validFile1 as { webkitRelativePath?: string }).webkitRelativePath = "invalid/data1.txt";

      const validFile2 = new File(["content"], "data2.txt", { type: "text/plain" });
      (validFile2 as { webkitRelativePath?: string }).webkitRelativePath =
        "experiment/Ambyte_1/data2.txt";

      const files = createMockFileList([validFile1, validFile2]);
      const result = validateAmbyteStructure(files);

      // Should be valid because at least one valid structure exists
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("constants", () => {
    it("should have correct MAX_FILE_SIZE", () => {
      expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
    });

    it("should have correct ALLOWED_EXTENSIONS", () => {
      expect(ALLOWED_EXTENSIONS).toEqual([".txt"]);
    });

    it("should have correct EXCLUDED_FILES", () => {
      expect(EXCLUDED_FILES).toEqual([".DS_Store"]);
    });
  });
});
