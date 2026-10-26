import { useActivity } from "@/components/activity/activity-context";
import type { ActivityEntry } from "@/components/activity/activity-context";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { env } from "~/env";
import { parseApiError } from "~/util/apiError";

import {
  UPLOAD_KIND_CONSTANTS,
  inferUploadSourceKind,
} from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentUploadSourceKind } from "@repo/api/domains/experiment/experiment.schema";
import { zExperimentUploadDataResponse } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import { useTranslation } from "@repo/i18n/client";
import { toast } from "@repo/ui/hooks/use-toast";

export type UploadValidationError =
  | { code: "noFiles" }
  | { code: "unsupportedFormat"; fileName: string }
  | { code: "wrongFormat"; fileName: string; expected: ExperimentUploadSourceKind }
  | { code: "oversizedFiles"; count: number }
  | { code: "tooManyFiles"; max: number }
  | { code: "ambyteInvalidStructure" }
  | { code: "ambyteOversizedFiles"; count: number };

export type UploadValidationResult =
  | UploadValidationError
  | { sourceKind: ExperimentUploadSourceKind };

interface UploadInput {
  params: { id: string };
  body: FormData;
  /** The id the backend records the upload under; also sent in the body. */
  uploadId: string;
  /** The target table's name, for the progress row and toasts. */
  label: string;
}

// uploadData is a native streaming multipart endpoint, intentionally off the
// oRPC contract (oRPC would buffer the body). `.body` carries the parsed error
// payload so `parseApiError` reads it the same way it did for the ts-rest error.
class UploadError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Upload failed with status ${status}`);
    this.name = "UploadError";
  }
}

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

  const { maxFileSize, maxFileCount } = UPLOAD_KIND_CONSTANTS.ambyte;
  const oversized = usable.filter((f) => f.size > maxFileSize).length;
  if (oversized > 0) {
    return { code: "ambyteOversizedFiles", count: oversized };
  }
  if (usable.length > maxFileCount) {
    return { code: "tooManyFiles", max: maxFileCount };
  }

  return { sourceKind: "ambyte" };
}

function validateTabular(
  files: FileList,
  expectedKind: Exclude<ExperimentUploadSourceKind, "ambyte">,
): UploadValidationResult {
  const usable = Array.from(files).filter((f) => !isExcluded(f));
  if (usable.length === 0) {
    return { code: "noFiles" };
  }
  for (const file of usable) {
    const kind = inferUploadSourceKind(file.name);
    if (kind === expectedKind) {
      continue;
    }
    // A recognized-but-different kind (e.g. .csv when tsv is selected) gets a
    // format-specific message; an unrecognized extension stays "unsupported".
    if (!kind || kind === "ambyte") {
      return { code: "unsupportedFormat", fileName: file.name };
    }
    return { code: "wrongFormat", fileName: file.name, expected: expectedKind };
  }

  const { maxFileSize, maxFileCount } = UPLOAD_KIND_CONSTANTS[expectedKind];
  const oversized = usable.filter((f) => f.size > maxFileSize).length;
  if (oversized > 0) {
    return { code: "oversizedFiles", count: oversized };
  }
  if (usable.length > maxFileCount) {
    return { code: "tooManyFiles", max: maxFileCount };
  }

  return { sourceKind: expectedKind };
}

export const useExperimentDataUpload = () => {
  const queryClient = useQueryClient();
  const { upsert } = useActivity();
  const { t } = useTranslation("experimentData");

  const trackTransfer = (variables: UploadInput, status: ActivityEntry["status"]) => {
    const now = new Date().toISOString();
    upsert({
      id: variables.uploadId,
      kind: "data_upload",
      title: variables.label,
      status,
      experimentId: variables.params.id,
      createdAt: now,
      updatedAt: now,
    });
  };

  // Callbacks here, not on mutate(), still run once the dialog that started the upload is closed.
  const mutation = useMutation({
    onMutate: (variables: UploadInput) => {
      trackTransfer(variables, "running");
      toast({
        description: t("experimentData.uploadDataModal.transfer.started", {
          table: variables.label,
        }),
      });
    },
    onSuccess: async (_data, variables) => {
      toast({
        description: t("experimentData.uploadDataModal.transfer.received", {
          table: variables.label,
        }),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperiment.queryKey({ input: { id: variables.params.id } }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.experiments.listUploads.key({ input: { id: variables.params.id } }),
        }),
      ]);

      // Succeeded only once the refetched list holds the upload's record, so it never drops out of view.
      trackTransfer(variables, "succeeded");
    },
    onError: (error, variables) => {
      trackTransfer(variables, "failed");
      toast({
        title: t("experimentData.uploadDataModal.transfer.failed", { table: variables.label }),
        description:
          parseApiError(error)?.message ?? t("experimentData.uploadDataModal.submitError.fallback"),
        variant: "destructive",
      });
    },
    mutationFn: async ({ params, body }: UploadInput) => {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/experiments/${params.id}/data/uploads`,
        {
          method: "POST",
          body,
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorBody: unknown = await response.json().catch(() => undefined);
        throw new UploadError(response.status, errorBody);
      }

      return zExperimentUploadDataResponse.parse(await response.json());
    },
  });

  const validate = (
    files: FileList,
    sourceKind: ExperimentUploadSourceKind,
  ): UploadValidationResult =>
    sourceKind === "ambyte" ? validateAmbyte(files) : validateTabular(files, sourceKind);

  const stripExcluded = (files: FileList): File[] =>
    Array.from(files).filter((f) => !isExcluded(f));

  return { ...mutation, validate, stripExcluded };
};
