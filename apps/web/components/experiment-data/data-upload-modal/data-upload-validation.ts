export interface ValidationResult {
  isValid: boolean;
  errors: { key: string; options?: Record<string, unknown> }[];
}

// File validation constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
export const ALLOWED_EXTENSIONS = [".txt"];

// Files to exclude from upload and validation
export const EXCLUDED_FILES = [".DS_Store"];

// Helper function to check if a file should be excluded
export const isExcludedFile = (file: File): boolean => {
  return EXCLUDED_FILES.some(
    (excludedFile) => file.name === excludedFile || file.webkitRelativePath.includes(excludedFile),
  );
};

// Ambyte folder structure validation
export const validateAmbyteStructure = (files: FileList): ValidationResult => {
  const errors: { key: string; options?: Record<string, unknown> }[] = [];

  if (files.length === 0) {
    errors.push({ key: "uploadModal.validation.noFiles" });
    return { isValid: false, errors };
  }

  // Check if we have files with webkitRelativePath (folder structure), excluding system files
  const filesWithPath = Array.from(files).filter(
    (file) => file.webkitRelativePath && !isExcludedFile(file),
  );

  if (filesWithPath.length === 0) {
    errors.push({ key: "uploadModal.validation.selectFolder" });
    return { isValid: false, errors };
  }

  // Extract the root folder pattern
  const rootFolders = new Set(filesWithPath.map((file) => file.webkitRelativePath.split("/")[0]));

  // Validate Ambyte folder structure
  let hasValidStructure = false;

  for (const rootFolder of rootFolders) {
    // Check for Ambyte_XX pattern at root level
    const isAmbyteFolder =
      rootFolder.startsWith("Ambyte_") &&
      rootFolder.substring(7).length > 0 &&
      !isNaN(Number(rootFolder.substring(7)));

    // If root folder is directly an Ambyte_N folder, it's valid
    if (isAmbyteFolder) {
      hasValidStructure = true;
      break;
    }

    // If root folder is not Ambyte_N, check if it contains Ambyte_N subdirectories
    const hasAmbyteSubdirs = filesWithPath.some((file) => {
      const pathSegments = file.webkitRelativePath.split("/");
      if (pathSegments.length >= 2 && pathSegments[0] === rootFolder) {
        const subdirName = pathSegments[1];
        return (
          subdirName.startsWith("Ambyte_") &&
          subdirName.substring(7).length > 0 &&
          !isNaN(Number(subdirName.substring(7)))
        );
      }
      return false;
    });

    if (hasAmbyteSubdirs) {
      hasValidStructure = true;
      break;
    }
  }

  if (!hasValidStructure) {
    errors.push({ key: "uploadModal.validation.invalidStructure" });
  }

  // Check file sizes (excluding system files)
  const oversizedFiles = Array.from(files).filter(
    (file) => file.size > MAX_FILE_SIZE && !isExcludedFile(file),
  );
  if (oversizedFiles.length > 0) {
    errors.push({
      key: "uploadModal.validation.fileSizeExceeded",
      options: { count: oversizedFiles.length },
    });
  }

  // Check file extensions (excluding system files)
  const invalidFiles = Array.from(files).filter((file) => {
    if (isExcludedFile(file)) return false;
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    return !ALLOWED_EXTENSIONS.includes(extension);
  });

  if (invalidFiles.length > 0) {
    errors.push({
      key: "uploadModal.validation.unsupportedExtensions",
      options: {
        count: invalidFiles.length,
        extensions: ALLOWED_EXTENSIONS.join(", "),
      },
    });
  }

  return { isValid: errors.length === 0, errors };
};
