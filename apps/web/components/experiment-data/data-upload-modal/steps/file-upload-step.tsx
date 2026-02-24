"use client";

import { useExperimentDataUpload } from "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n/client";
import { Button, FileUpload } from "@repo/ui/components";

import { validateAmbyteStructure, isExcludedFile } from "../data-upload-validation";

interface FileUploadStepProps {
  experimentId: string;
  onBack: () => void;
  onUploadSuccess: () => void;
}

export const FileUploadStep: React.FC<FileUploadStepProps> = ({
  experimentId,
  onBack,
  onUploadSuccess,
}) => {
  const { t } = useTranslation("experiments");
  const [selectedFiles, setSelectedFiles] = React.useState<FileList | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<
    { key: string; options?: Record<string, unknown> }[]
  >([]);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [excludedFiles, setExcludedFiles] = React.useState<string[]>([]);

  const { mutate: uploadData, isPending: isUploading } = useExperimentDataUpload();

  const handleFileSelect = (files: FileList | null) => {
    setSelectedFiles(files);
    setValidationErrors([]);
    setExcludedFiles([]);
    setUploadError(null); // Clear previous errors when files change

    if (files) {
      // Find excluded files in the current selection with their full paths
      const foundExcludedFiles = Array.from(files)
        .filter((file) => isExcludedFile(file))
        .map((file) => file.webkitRelativePath || file.name);

      setExcludedFiles(foundExcludedFiles);

      // Filter out excluded system files before validation
      const validFiles = Array.from(files).filter((file) => !isExcludedFile(file));

      // Check if there are any valid files after filtering
      if (validFiles.length === 0) {
        setValidationErrors([{ key: "uploadModal.validation.noValidFiles" }]);
        return;
      }

      const validation = validateAmbyteStructure(files);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFiles || validationErrors.length > 0) return;

    const formData = new FormData();
    formData.append("sourceType", "ambyte");

    // Filter out excluded system files before uploading
    const validFiles = Array.from(selectedFiles).filter((file) => !isExcludedFile(file));

    validFiles.forEach((file) => {
      formData.append("files", file);
    });

    uploadData(
      {
        params: { id: experimentId },
        body: formData,
      },
      {
        onSuccess: () => onUploadSuccess(),
        onError: (error) =>
          setUploadError(parseApiError(error)?.message ?? t("uploadModal.validation.uploadFailed")),
      },
    );
  };

  // Translate validation errors
  const translatedValidationErrors = validationErrors.map((error) => t(error.key, error.options));

  return (
    <div className="space-y-6">
      <FileUpload
        files={selectedFiles}
        onFilesChange={handleFileSelect}
        isUploading={isUploading}
        allowDirectories={true}
        placeholder={t("uploadModal.fileUpload.selectFolder")}
        selectedText={t("uploadModal.fileUpload.changeSelection")}
        browseInstruction={t("uploadModal.fileUpload.browseInstruction")}
        selectedFilesText={t("uploadModal.fileUpload.selectedFiles", {
          count: selectedFiles?.length ?? 0,
        })}
        validationTitle={t("uploadModal.validation.title")}
        validationErrors={translatedValidationErrors}
        uploadError={
          uploadError
            ? {
                title: t("uploadModal.error.title"),
                message: uploadError,
                retryMessage: t("uploadModal.error.retry"),
              }
            : undefined
        }
        uploadingText={t("uploadModal.fileUpload.uploading")}
        uploadingDescription={t("uploadModal.fileUpload.uploadingDescription")}
      />

      {/* Warning about excluded files - only show if there are excluded files */}
      {excludedFiles.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-800">
                <strong>{t("uploadModal.excludedFiles.note")}</strong>{" "}
                {t("uploadModal.excludedFiles.warningMessage", { count: excludedFiles.length })}{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">
                  {excludedFiles.join(", ")}
                </code>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={isUploading}>
          {t("uploadModal.fileUpload.back")}
        </Button>
        <Button
          onClick={handleUpload}
          disabled={!selectedFiles || validationErrors.length > 0 || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("uploadModal.fileUpload.uploading")}
            </>
          ) : (
            t("uploadModal.fileUpload.uploadFiles")
          )}
        </Button>
      </div>
    </div>
  );
};
