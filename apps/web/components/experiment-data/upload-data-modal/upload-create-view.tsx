"use client";

import { useExperimentDataUpload } from "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload";
import type { UploadValidationError } from "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileSpreadsheet, FolderUp } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";

import {
  UPLOAD_KIND_CONSTANTS,
  zExperimentUploadFormFields,
} from "@repo/api/domains/experiment/experiment.schema";
import type {
  ExperimentUploadFormFields,
  ExperimentUploadSourceKind,
} from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { DialogBody, DialogFooter } from "@repo/ui/components/dialog";
import { FileUpload } from "@repo/ui/components/file-upload";

import { UploadTargetPicker } from "./upload-target-picker";

export interface UploadCreateViewProps {
  experimentId: string;
  canManage: boolean;
  sourceKind: ExperimentUploadSourceKind;
  onBack: () => void;
  onUploaded: () => void;
}

export function UploadCreateView({
  experimentId,
  canManage,
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

  const [files, setFiles] = React.useState<FileList | null>(null);
  const [fileError, setFileError] = React.useState<UploadValidationError | null>(null);

  const form = useForm<ExperimentUploadFormFields>({
    resolver: zodResolver(zExperimentUploadFormFields),
    mode: "onSubmit",
    defaultValues: canManage
      ? { targetKind: "new", sourceKind, targetName: "" }
      : { targetKind: "existing", sourceKind, uploadTableId: "" },
  });

  const targetKind = form.watch("targetKind");

  // Tables resolve after mount; default to appending once an upload table exists.
  const hasSyncedTargetDefault = React.useRef(false);
  React.useEffect(() => {
    if (hasSyncedTargetDefault.current || tables === undefined) {
      return;
    }
    hasSyncedTargetDefault.current = true;

    if (hasExistingTables) {
      form.setValue("targetKind", "existing");
    }
  }, [tables, hasExistingTables, form]);

  const extensions = isAmbyte ? [] : UPLOAD_KIND_CONSTANTS[sourceKind].extensions;
  const formatLabel = t(`experimentData.uploadDataModal.history.sourceKind.${sourceKind}`);

  const { mutate: uploadData, validate, stripExcluded } = useExperimentDataUpload();

  const handleFilesChange = (selected: FileList | null) => {
    setFiles(selected);
    // Validate on selection so format/size errors surface before the user hits Upload.
    if (!selected || selected.length === 0) {
      setFileError(null);
      return;
    }
    const fileCheck = validate(selected, sourceKind);
    setFileError("code" in fileCheck ? fileCheck : null);
  };

  const targetTableName = (values: ExperimentUploadFormFields): string =>
    values.targetKind === "new"
      ? values.targetName
      : (uploadTables.find((table) => table.identifier === values.uploadTableId)?.displayName ??
        values.uploadTableId);

  const onSubmit = (values: ExperimentUploadFormFields) => {
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

    // The backend refuses a taken name too, but only after the upload is under way.
    const isNameTaken =
      values.targetKind === "new" &&
      uploadTables.some((table) => table.displayName === values.targetName);
    if (isNameTaken) {
      form.setError("targetName", {
        message: t("experimentData.uploadDataModal.validation.nameTaken", {
          name: values.targetName,
        }),
      });
      return;
    }

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

    // The upload carries on in the background; progress and the outcome arrive as toasts.
    uploadData({ params: { id: experimentId }, body: formData, label: targetTableName(values) });
    onUploaded();
  };

  const fileErrorMessage = useFileErrorMessage(fileError);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-col gap-5">
      <DialogBody className="space-y-5">
        <UploadTargetPicker
          control={form.control}
          canManage={canManage}
          targetKind={targetKind}
          uploadTables={uploadTables}
        />

        <FileUpload
          files={files}
          onFilesChange={handleFilesChange}
          allowDirectories={isAmbyte}
          accept={isAmbyte ? undefined : extensions.join(",")}
          multiple
          icon={
            isAmbyte ? (
              <FolderUp className="text-muted-foreground h-8 w-8" />
            ) : (
              <FileSpreadsheet className="text-muted-foreground h-8 w-8" />
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
        />
      </DialogBody>

      <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          {t("experimentData.uploadDataModal.actions.back")}
        </Button>
        <Button type="submit" disabled={!canManage && !hasExistingTables}>
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
