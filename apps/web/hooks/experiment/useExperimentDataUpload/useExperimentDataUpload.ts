import { tsr } from "@/lib/tsr";

import { UPLOAD_KIND_CONSTANTS, inferUploadSourceKind } from "@repo/api/schemas/experiment.schema";
import type { UploadSourceKind } from "@repo/api/schemas/experiment.schema";

export type UploadValidationError =
  | { code: "noFiles" }
  | { code: "unsupportedFormat"; fileName: string }
  | { code: "mixedFormats" }
  | { code: "ambyteInvalidStructure" }
  | { code: "ambyteOversizedFiles"; count: number };

export type UploadValidationResult = UploadValidationError | { sourceKind: UploadSourceKind };

const EXCLUDED_FILES = [".DS_Store"];

function isExcluded(file: File): boolean {
  return EXCLUDED_FILES.some(
    (name) => file.name === name || file.webkitRelativePath.includes(name),
  );
}

function validateAmbyte(files: FileList): UploadValidationResult {
  const usable = Array.from(files).filter((f) => !isExcluded(f));
  if (usable.length === 0) {
    return { code: "noFiles" };
  }

  const withPath = usable.filter((f) => f.webkitRelativePath);
  if (withPath.length === 0) {
    return { code: "ambyteInvalidStructure" };
  }

  const rootFolders = new Set(withPath.map((f) => f.webkitRelativePath.split("/")[0]));
  const isAmbyteSegment = (segment: string): boolean =>
    segment.startsWith("Ambyte_") &&
    segment.length > "Ambyte_".length &&
    !Number.isNaN(Number(segment.slice("Ambyte_".length)));

  const hasValidStructure = Array.from(rootFolders).some((root) => {
    if (isAmbyteSegment(root)) {
      return true;
    }
    return withPath.some((f) => {
      const parts = f.webkitRelativePath.split("/");
      return parts.length >= 2 && parts[0] === root && isAmbyteSegment(parts[1]);
    });
  });

  if (!hasValidStructure) {
    return { code: "ambyteInvalidStructure" };
  }

  const max = UPLOAD_KIND_CONSTANTS.ambyte.maxFileSize;
  const oversized = usable.filter((f) => f.size > max).length;
  if (oversized > 0) {
    return { code: "ambyteOversizedFiles", count: oversized };
  }

  return { sourceKind: "ambyte" };
}

function validateTabular(
  files: FileList,
  expectedKind: Exclude<UploadSourceKind, "ambyte">,
): UploadValidationResult {
  const usable = Array.from(files).filter((f) => !isExcluded(f));
  if (usable.length === 0) {
    return { code: "noFiles" };
  }
  for (const file of usable) {
    const kind = inferUploadSourceKind(file.name);
    if (!kind || kind === "ambyte" || kind !== expectedKind) {
      return kind && kind !== expectedKind
        ? { code: "mixedFormats" }
        : { code: "unsupportedFormat", fileName: file.name };
    }
  }
  return { sourceKind: expectedKind };
}

export const useExperimentDataUpload = () => {
  const queryClient = tsr.useQueryClient();

  const mutation = tsr.experiments.uploadData.useMutation({
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["experiments", variables.params.id],
      });
    },
  });

  const validate = (files: FileList, sourceKind: UploadSourceKind): UploadValidationResult =>
    sourceKind === "ambyte" ? validateAmbyte(files) : validateTabular(files, sourceKind);

  const stripExcluded = (files: FileList): File[] =>
    Array.from(files).filter((f) => !isExcluded(f));

  return { ...mutation, validate, stripExcluded };
};
