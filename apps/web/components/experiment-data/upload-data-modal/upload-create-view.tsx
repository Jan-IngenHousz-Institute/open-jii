"use client";

import { useExperimentDataUpload } from "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload";
import type { UploadValidationError } from "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileSpreadsheet, FolderUp, Loader2 } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";
import { parseApiError } from "~/util/apiError";

import {
  AMBYTE_UPLOAD_TABLE_NAME,
  UPLOAD_KIND_CONSTANTS,
  zUploadFormFields,
} from "@repo/api/schemas/experiment.schema";
import type { UploadFormFields, UploadSourceKind } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { DialogFooter } from "@repo/ui/components/dialog";
import { FileUpload } from "@repo/ui/components/file-upload";

import { UploadTargetPicker } from "./upload-target-picker";

export interface UploadCreateViewProps {
  experimentId: string;
  sourceKind: UploadSourceKind;
  onBack: () => void;
  onUploaded: () => void;
}

export function UploadCreateView({
  experimentId,
  sourceKind,
  onBack,
  onUploaded,
}: UploadCreateViewProps) {
  const { t } = useTranslation("experimentData");
  const { tables } = useExperimentTables(experimentId);

  const isAmbyte = sourceKind === "ambyte";

  const uploadTables = React.useMemo(
    () => (tables ?? []).filter((table) => table.tableType === "upload"),
    [tables],
  );
  const hasExistingTables = uploadTables.length > 0;

  // Ambyte uploads always land in one experiment-wide table named "raw_ambyte_data".
  // If it already exists, append; otherwise mint it on first upload.
  const existingAmbyteTable = React.useMemo(
    () => uploadTables.find((table) => table.displayName === AMBYTE_UPLOAD_TABLE_NAME),
    [uploadTables],
  );

  const [files, setFiles] = React.useState<FileList | null>(null);
  const [fileError, setFileError] = React.useState<UploadValidationError | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm<UploadFormFields>({
    resolver: zodResolver(zUploadFormFields),
    mode: "onSubmit",
    // Ambyte always targets its fixed table, so seed the name up front; the
    // effect below upgrades to "append" if that table already exists.
    defaultValues: {
      targetKind: "new",
      sourceKind,
      targetName: isAmbyte ? AMBYTE_UPLOAD_TABLE_NAME : "",
    },
  });

  const targetKind = form.watch("targetKind");

  // Tables resolve after mount; settle the default target once they load. Ambyte
  // pins to its fixed table; tabular kinds default to appending when one exists.
  const hasSyncedTargetDefault = React.useRef(false);
  React.useEffect(() => {
    if (hasSyncedTargetDefault.current || tables === undefined) {
      return;
    }
    hasSyncedTargetDefault.current = true;

    if (isAmbyte) {
      if (existingAmbyteTable) {
        form.reset({
          targetKind: "existing",
          sourceKind,
          uploadTableId: existingAmbyteTable.identifier,
        });
      } else {
        form.reset({ targetKind: "new", sourceKind, targetName: AMBYTE_UPLOAD_TABLE_NAME });
      }
      return;
    }

    if (hasExistingTables) {
      form.reset({ targetKind: "existing", sourceKind, uploadTableId: undefined });
    }
  }, [tables, isAmbyte, hasExistingTables, existingAmbyteTable, sourceKind, form]);

  const extensions = isAmbyte ? [] : UPLOAD_KIND_CONSTANTS[sourceKind].extensions;
  const formatLabel = t(`experimentData.uploadDataModal.history.sourceKind.${sourceKind}`);

  const {
    mutate: uploadData,
    isPending: isUploading,
    validate,
    stripExcluded,
  } = useExperimentDataUpload();

  const handleFilesChange = (selected: FileList | null) => {
    setFiles(selected);
    setSubmitError(null);
    // Validate on selection so format/size errors surface before the user hits Upload.
    if (!selected || selected.length === 0) {
      setFileError(null);
      return;
    }
    const fileCheck = validate(selected, sourceKind);
    setFileError("code" in fileCheck ? fileCheck : null);
  };

  const onSubmit = (values: UploadFormFields) => {
    if (!files || files.length === 0) {
      setFileError({ code: "noFiles" });
      return;
    }

    const fileCheck = validate(files, values.sourceKind);
    if ("code" in fileCheck) {
      setFileError(fileCheck);
      return;
    }

    setFileError(null);
    setSubmitError(null);

    const formData = new FormData();
    formData.append("sourceKind", values.sourceKind);
    formData.append("targetKind", values.targetKind);
    if (values.targetKind === "new") {
      formData.append("targetName", values.targetName);
    } else {
      formData.append("uploadTableId", values.uploadTableId);
    }
    for (const file of stripExcluded(files)) {
      formData.append("files", file);
    }

    uploadData(
      {
        params: { id: experimentId },
        body: formData,
      },
      {
        onSuccess: () => onUploaded(),
        onError: (error) => {
          const message = parseApiError(error)?.message;
          setSubmitError(message ?? t("experimentData.uploadDataModal.submitError.fallback"));
        },
      },
    );
  };

  const fileErrorMessage = useFileErrorMessage(fileError);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {!isAmbyte && (
        <UploadTargetPicker
          control={form.control}
          targetKind={targetKind}
          uploadTables={uploadTables}
          disabled={isUploading}
        />
      )}

      <FileUpload
        files={files}
        onFilesChange={handleFilesChange}
        isUploading={isUploading}
        allowDirectories={isAmbyte}
        accept={isAmbyte ? undefined : extensions.join(",")}
        multiple
        icon={
          isAmbyte ? (
            <FolderUp className="h-8 w-8 text-gray-400" />
          ) : (
            <FileSpreadsheet className="h-8 w-8 text-gray-400" />
          )
        }
        placeholder={
          isAmbyte
            ? t("experimentData.uploadDataModal.files.dropzone.ambytePlaceholder")
            : t("experimentData.uploadDataModal.files.dropzone.placeholder", {
                format: formatLabel,
              })
        }
        selectedText={t("experimentData.uploadDataModal.files.dropzone.selected")}
        browseInstruction={
          isAmbyte
            ? t("experimentData.uploadDataModal.files.dropzone.ambyteHint")
            : t("experimentData.uploadDataModal.files.dropzone.accepted", {
                extensions: extensions.join(", "),
              })
        }
        selectedFilesText={t("experimentData.uploadDataModal.files.dropzone.selectedFiles")}
        validationTitle={t("experimentData.uploadDataModal.validation.title")}
        validationErrors={fileErrorMessage ? [fileErrorMessage] : []}
        uploadError={
          submitError
            ? {
                title: t("experimentData.uploadDataModal.submitError.title"),
                message: submitError,
              }
            : undefined
        }
        uploadingText={t("experimentData.uploadDataModal.status.processing.title")}
        uploadingDescription={t("experimentData.uploadDataModal.status.processing.description")}
      />

      <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={isUploading}>
          {t("experimentData.uploadDataModal.actions.back")}
        </Button>
        <Button type="submit" disabled={isUploading}>
          {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("experimentData.uploadDataModal.actions.upload")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function useFileErrorMessage(error: UploadValidationError | null): string | null {
  const { t } = useTranslation("experimentData");
  if (!error) {
    return null;
  }
  switch (error.code) {
    case "noFiles":
      return t("experimentData.uploadDataModal.validation.noFiles");
    case "unsupportedFormat":
      return t("experimentData.uploadDataModal.validation.unsupportedFormat", {
        fileName: error.fileName,
      });
    case "wrongFormat":
      return t("experimentData.uploadDataModal.validation.wrongFormat", {
        fileName: error.fileName,
        format: t(`experimentData.uploadDataModal.history.sourceKind.${error.expected}`),
      });
    case "oversizedFiles":
      return t("experimentData.uploadDataModal.validation.oversizedFiles", {
        count: error.count,
      });
    case "tooManyFiles":
      return t("experimentData.uploadDataModal.validation.tooManyFiles", {
        max: error.max,
      });
    case "ambyteInvalidStructure":
      return t("experimentData.uploadDataModal.validation.ambyteInvalidStructure");
    case "ambyteOversizedFiles":
      return t("experimentData.uploadDataModal.validation.ambyteOversizedFiles", {
        count: error.count,
      });
    default:
      return null;
  }
}
