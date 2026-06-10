"use client";

import { useExperimentDataUpload } from "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload";
import type { UploadValidationError } from "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";
import { parseApiError } from "~/util/apiError";

import {
  AMBYTE_UPLOAD_TABLE_NAME,
  UPLOAD_KIND_CONSTANTS,
  zUploadFormFields,
  zUploadSourceKind,
} from "@repo/api/schemas/experiment.schema";
import type { UploadFormFields } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { UploadHistoryPanel } from "./history/upload-history-panel";
import { UploadTargetPicker } from "./upload-target-picker";

export interface UploadDataModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SOURCE_KIND_OPTIONS = zUploadSourceKind.options;

export function UploadDataModal({ experimentId, open, onOpenChange }: UploadDataModalProps) {
  const { t } = useTranslation("experimentData");
  const { tables } = useExperimentTables(experimentId);

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
    defaultValues: {
      targetKind: "new",
      sourceKind: "csv",
      targetName: "",
    },
  });

  const targetKind = form.watch("targetKind");
  const sourceKind = form.watch("sourceKind");
  const isAmbyte = sourceKind === "ambyte";

  React.useEffect(() => {
    if (!open) {
      return;
    }
    if (hasExistingTables) {
      form.reset({ targetKind: "existing", sourceKind: "csv", uploadTableId: undefined });
    } else {
      form.reset({ targetKind: "new", sourceKind: "csv", targetName: "" });
    }
    setFiles(null);
    setFileError(null);
    setSubmitError(null);
  }, [open, hasExistingTables, form]);

  // isAmbyte is the pre-change value, so it doubles as transition detection.
  const applyTargetForSourceKind = (nextKind: string) => {
    if (nextKind === "ambyte") {
      if (existingAmbyteTable) {
        form.setValue("targetKind", "existing");
        form.setValue("uploadTableId", existingAmbyteTable.identifier);
      } else {
        form.setValue("targetKind", "new");
        form.setValue("targetName", AMBYTE_UPLOAD_TABLE_NAME);
      }
    } else if (isAmbyte) {
      if (hasExistingTables) {
        form.setValue("targetKind", "existing");
        form.setValue("uploadTableId", "");
      } else {
        form.setValue("targetKind", "new");
        form.setValue("targetName", "");
      }
    }
  };

  const acceptList = React.useMemo(() => {
    if (isAmbyte) {
      return undefined;
    }
    return UPLOAD_KIND_CONSTANTS[sourceKind].extensions.join(",");
  }, [sourceKind, isAmbyte]);

  const {
    mutate: uploadData,
    isPending: isUploading,
    validate,
    stripExcluded,
  } = useExperimentDataUpload();

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(event.target.files);
    setFileError(null);
    setSubmitError(null);
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
        onError: (error) => {
          const message = parseApiError(error)?.message;
          setSubmitError(message ?? t("experimentData.uploadDataModal.submitError.fallback"));
        },
      },
    );
  };

  const fileErrorMessage = useFileErrorMessage(fileError);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("experimentData.uploadDataModal.title")}
          </DialogTitle>
          <DialogDescription>{t("experimentData.uploadDataModal.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <Controller
            control={form.control}
            name="sourceKind"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label htmlFor="source-kind">
                  {t("experimentData.uploadDataModal.sourceKind.label")}
                </Label>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    applyTargetForSourceKind(value);
                  }}
                  disabled={isUploading}
                >
                  <SelectTrigger id="source-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_KIND_OPTIONS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {t(`experimentData.uploadDataModal.history.sourceKind.${kind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />

          {!isAmbyte && (
            <UploadTargetPicker
              control={form.control}
              targetKind={targetKind}
              uploadTables={uploadTables}
              disabled={isUploading}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="upload-files">
              {isAmbyte
                ? t("experimentData.uploadDataModal.files.ambyteLabel")
                : t("experimentData.uploadDataModal.files.label")}
            </Label>
            <Input
              id="upload-files"
              type="file"
              {...(isAmbyte ? folderProps() : { accept: acceptList, multiple: true })}
              disabled={isUploading}
              onChange={handleFilesChange}
            />
          </div>

          {fileErrorMessage && (
            <Alert variant="destructive">
              <AlertTitle>{t("experimentData.uploadDataModal.validation.title")}</AlertTitle>
              <AlertDescription>{fileErrorMessage}</AlertDescription>
            </Alert>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertTitle>{t("experimentData.uploadDataModal.submitError.title")}</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <UploadHistoryPanel experimentId={experimentId} enabled={open} />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              {t("experimentData.uploadDataModal.actions.close")}
            </Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("experimentData.uploadDataModal.actions.upload")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// `webkitdirectory` isn't in React's typings; this casts it through as a plain
// HTML attribute so the file input recurses into the selected folder.
function folderProps(): Record<string, unknown> {
  return { webkitdirectory: "", directory: "", multiple: true };
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
    case "mixedFormats":
      return t("experimentData.uploadDataModal.validation.mixedFormats");
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
