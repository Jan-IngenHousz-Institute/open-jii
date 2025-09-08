"use client";

import { useExperimentDataUpload } from "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import * as React from "react";

import type { UploadExperimentDataResponse } from "@repo/api";
import { useTranslation } from "@repo/i18n/client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  FileUpload,
} from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

export interface ValidationResult {
  isValid: boolean;
  errors: { key: string; options?: Record<string, unknown> }[];
}

// File validation constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
const ALLOWED_EXTENSIONS = [".txt"];

// Files to exclude from upload and validation
const EXCLUDED_FILES = [".DS_Store"];

// Helper function to check if a file should be excluded
const isExcludedFile = (file: File): boolean => {
  return EXCLUDED_FILES.some(
    (excludedFile) => file.name === excludedFile || file.webkitRelativePath.includes(excludedFile),
  );
};

// Ambyte folder structure validation
const validateAmbyteStructure = (files: FileList): ValidationResult => {
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

interface SensorFamily {
  id: "multispeq" | "ambyte";
  label: string;
  disabled: boolean;
  description?: string;
}

// CVA variants for different upload steps and states
const uploadStepVariants = cva("space-y-6", {
  variants: {
    alignment: {
      left: "",
      center: "text-center",
    },
    spacing: {
      normal: "space-y-6",
      compact: "space-y-4",
    },
  },
  defaultVariants: {
    alignment: "left",
    spacing: "normal",
  },
});

const sensorCardVariants = cva(
  "flex items-start space-x-3 rounded-lg border p-4 transition-colors",
  {
    variants: {
      state: {
        available: "hover:bg-muted/50 cursor-pointer",
        disabled: "bg-muted/50 cursor-not-allowed opacity-50",
        selected: "border-primary bg-primary/10",
      },
    },
    defaultVariants: {
      state: "available",
    },
  },
);

const statusIconVariants = cva("mb-4 h-12 w-12", {
  variants: {
    type: {
      loading: "text-primary animate-spin",
      success: "text-green-500",
      error: "text-destructive",
    },
  },
});

interface UploadState {
  step: "sensor-selection" | "file-upload" | "uploading" | "success" | "error";
  selectedSensor: SensorFamily | null;
  selectedFiles: FileList | null;
  uploadProgress: number;
  error: string | null;
  uploadResponse: UploadExperimentDataResponse | null;
}

interface AmbyteUploadModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: (response: UploadExperimentDataResponse) => void;
}

const SENSOR_FAMILIES: SensorFamily[] = [
  {
    id: "multispeq",
    label: "MultispeQ",
    disabled: true,
    description: "MultispeQ sensor data upload (coming soon)",
  },
  {
    id: "ambyte",
    label: "Ambyte",
    disabled: false,
    description: "Upload Ambyte sensor folders containing measurement data",
  },
];

// Step Components
interface SensorSelectionStepProps {
  selectedSensor: SensorFamily | null;
  onSensorSelect: (sensorId: string) => void;
}

const SensorSelectionStep: React.FC<SensorSelectionStepProps> = ({
  selectedSensor,
  onSensorSelect,
}) => {
  const { t } = useTranslation("experiments");

  return (
    <div className={uploadStepVariants()}>
      <div>
        <Label className="text-base font-medium">{t("uploadModal.sensorFamily.label")}</Label>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("uploadModal.sensorFamily.description")}
        </p>
      </div>

      <RadioGroup
        value={selectedSensor?.id ?? ""}
        onValueChange={onSensorSelect}
        className="space-y-3"
      >
        {SENSOR_FAMILIES.map((sensor) => (
          <div
            key={sensor.id}
            data-testid={`sensor-option-${sensor.id}`}
            className={sensorCardVariants({
              state: sensor.disabled ? "disabled" : "available",
            })}
            onClick={() => !sensor.disabled && onSensorSelect(sensor.id)}
          >
            <RadioGroupItem
              value={sensor.id}
              disabled={sensor.disabled}
              className="mt-0.5"
              aria-label={sensor.label}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label className="cursor-pointer font-medium">
                  {t(`uploadModal.sensorTypes.${sensor.id}.label`)}
                </Label>
                {sensor.disabled && (
                  <span className="bg-muted text-muted-foreground rounded px-2 py-1 text-xs">
                    {t("uploadModal.sensorTypes.multispeq.comingSoon")}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {t(`uploadModal.sensorTypes.${sensor.id}.description`)}
              </p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

interface FileUploadStepProps {
  experimentId: string;
  onBack: () => void;
  onUploadSuccess: () => void;
}

const FileUploadStep: React.FC<FileUploadStepProps> = ({
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

  const { mutate: uploadData, isPending: isUploading } = useExperimentDataUpload({
    onSuccess: () => {
      onUploadSuccess();
    },
    onError: (error) => {
      setUploadError(
        error instanceof Error ? error.message : t("uploadModal.validation.uploadFailed"),
      );
    },
  });

  const handleFileSelect = (files: FileList | null) => {
    setSelectedFiles(files);
    setValidationErrors([]);
    setUploadError(null);

    if (files) {
      // Find excluded files in the current selection with their full paths
      const foundExcludedFiles = Array.from(files)
        .filter((file) => isExcludedFile(file))
        .map((file) => file.webkitRelativePath || file.name);

      setExcludedFiles(foundExcludedFiles);

      const validation = validateAmbyteStructure(files);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
      }
    } else {
      setExcludedFiles([]);
    }
  };

  const handleUpload = () => {
    if (!selectedFiles || validationErrors.length > 0) return;

    const formData = new FormData();
    formData.append("sourceType", "ambyte");

    // Filter out excluded system files before uploading
    const validFiles = Array.from(selectedFiles).filter((file) => !isExcludedFile(file));

    // Ensure we have files to upload after filtering
    if (validFiles.length === 0) {
      setUploadError(t("uploadModal.validation.noValidFiles"));
      return;
    }

    validFiles.forEach((file) => {
      formData.append("files", file);
    });

    uploadData({
      params: { id: experimentId },
      body: formData,
    });
  };

  // Translate validation errors
  const translatedValidationErrors = validationErrors.map((error) => t(error.key, error.options));

  return (
    <div className={uploadStepVariants()}>
      <div>
        <Label className="text-base font-medium">{t("uploadModal.fileUpload.title")}</Label>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("uploadModal.fileUpload.description")}
        </p>
      </div>

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
        uploadError={uploadError}
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

const UploadingStep: React.FC = () => {
  const { t } = useTranslation("experiments");

  return (
    <div className={uploadStepVariants({ alignment: "center" })}>
      <div className="flex flex-col items-center">
        <Loader2 className={statusIconVariants({ type: "loading" })} />
        <h3 className="text-lg font-medium">{t("uploadModal.uploading.title")}</h3>
        <p className="text-muted-foreground text-sm">{t("uploadModal.uploading.description")}</p>
      </div>
    </div>
  );
};

interface SuccessStepProps {
  onClose: () => void;
}

const SuccessStep: React.FC<SuccessStepProps> = ({ onClose }) => {
  const { t } = useTranslation("experiments");

  return (
    <div className={uploadStepVariants({ alignment: "center" })}>
      <div className="flex flex-col items-center">
        <CheckCircle className={statusIconVariants({ type: "success" })} />
        <h3 className="text-lg font-medium text-green-700">{t("uploadModal.success.title")}</h3>
        <p className="text-muted-foreground text-sm">{t("uploadModal.success.description")}</p>
      </div>

      <Button onClick={onClose} className="w-full">
        {t("uploadModal.success.close")}
      </Button>
    </div>
  );
};

interface ErrorStepProps {
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

const ErrorStep: React.FC<ErrorStepProps> = ({ error, onClose, onRetry }) => {
  const { t } = useTranslation("experiments");

  return (
    <div className={uploadStepVariants({ alignment: "center" })}>
      <div className="flex flex-col items-center">
        <AlertCircle className={statusIconVariants({ type: "error" })} />
        <h3 className="text-destructive text-lg font-medium">{t("uploadModal.error.title")}</h3>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">
          {t("uploadModal.error.close")}
        </Button>
        <Button onClick={onRetry} className="flex-1">
          {t("uploadModal.error.retry")}
        </Button>
      </div>
    </div>
  );
};

export function AmbyteUploadModal({
  experimentId,
  open,
  onOpenChange,
  onUploadSuccess,
}: AmbyteUploadModalProps) {
  const { t } = useTranslation("experiments");
  const { isPending: isLoading } = useExperimentDataUpload({
    onSuccess: (data) => {
      setState((prev) => ({
        ...prev,
        step: "success",
        uploadResponse: data as UploadExperimentDataResponse,
      }));
      onUploadSuccess?.(data as UploadExperimentDataResponse);
    },
    onError: (_error) => {
      setState((prev) => ({
        ...prev,
        step: "error",
        error: "Upload failed",
      }));
    },
  });

  const [state, setState] = React.useState<UploadState>({
    step: "sensor-selection",
    selectedSensor: null,
    selectedFiles: null,
    uploadProgress: 0,
    error: null,
    uploadResponse: null,
  });

  // Update state based on upload hook status
  React.useEffect(() => {
    if (isLoading && state.step !== "uploading") {
      setState((prev) => ({ ...prev, step: "uploading" }));
    }
  }, [isLoading, state.step]);

  const handleSensorSelect = (sensorId: string) => {
    const sensor = SENSOR_FAMILIES.find((s) => s.id === sensorId);
    if (sensor && !sensor.disabled) {
      setState((prev) => ({
        ...prev,
        selectedSensor: sensor,
        step: "file-upload",
      }));
    }
  };

  const handleClose = () => {
    onOpenChange(false);

    // Reset state to initial values
    setState({
      step: "sensor-selection",
      selectedSensor: null,
      selectedFiles: null,
      uploadProgress: 0,
      error: null,
      uploadResponse: null,
    });
  };

  const handleRetry = () => {
    setState((prev) => ({
      ...prev,
      step: "sensor-selection",
      selectedFiles: null,
      error: null,
    }));
  };

  const renderCurrentStep = () => {
    switch (state.step) {
      case "sensor-selection":
        return (
          <SensorSelectionStep
            selectedSensor={state.selectedSensor}
            onSensorSelect={handleSensorSelect}
          />
        );

      case "file-upload":
        return (
          <FileUploadStep
            experimentId={experimentId}
            onBack={handleRetry}
            onUploadSuccess={() => {
              setState((prev) => ({ ...prev, step: "success" }));
              // FileUploadForm handles its own success callback,
              // but we can also call the parent's onUploadSuccess if needed
            }}
          />
        );

      case "uploading":
        return <UploadingStep />;

      case "success":
        return <SuccessStep onClose={handleClose} />;

      case "error":
        return <ErrorStep error={state.error} onClose={handleClose} onRetry={handleRetry} />;

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("uploadModal.title")}</DialogTitle>
          <DialogDescription>{t("uploadModal.description")}</DialogDescription>
        </DialogHeader>

        {renderCurrentStep()}
      </DialogContent>
    </Dialog>
  );
}
