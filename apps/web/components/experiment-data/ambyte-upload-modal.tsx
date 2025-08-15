"use client";

import { CheckCircle, Loader2, Upload, AlertCircle } from "lucide-react";
import * as React from "react";
import { useAmbyteUploadWrapper } from "~/hooks/experiment/useAmbyteUpload/useAmbyteUpload";

import type { UploadExperimentDataResponse } from "@repo/api";
import { useTranslation } from "@repo/i18n/client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FileUpload,
  Label,
  RadioGroup,
  RadioGroupItem,
} from "@repo/ui/components";
import type { ValidationResult } from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

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
    description: "Upload Ambyte sensor folder or individual Ambit subfolders",
  },
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function validateAmbyteStructure(files: FileList): ValidationResult {
  if (files.length === 0) {
    return { isValid: false, errors: ["Please select files"] };
  }

  const filePaths = Array.from(files).map((f) => f.webkitRelativePath || f.name);

  // Check for Ambyte_X pattern
  const hasAmbyteRoot = filePaths.some((path) => /^Ambyte_\d+\//.test(path));

  // Check for numbered folder pattern (any number)
  const hasNumberedRoot = filePaths.some((path) => /^\d+\//.test(path));

  // Check if it's a zip file with valid name
  const isValidZip =
    files.length === 1 &&
    files[0].name.endsWith(".zip") &&
    (/^Ambyte_\d+\.zip$/i.test(files[0].name) || /^\d+\.zip$/i.test(files[0].name));

  if (!hasAmbyteRoot && !hasNumberedRoot && !isValidZip) {
    return {
      isValid: false,
      errors: [
        "Invalid folder structure. Expected Ambyte_X folder, numbered subfolder, or valid zip file.",
      ],
    };
  }

  // Validate file types if it's a folder structure
  if (!isValidZip) {
    const invalidFiles = filePaths.filter((path) => {
      const fileName = path.split("/").pop() ?? "";
      return (
        !fileName.endsWith(".txt") &&
        fileName !== "ambyte_log.txt" &&
        fileName !== "config.txt" &&
        fileName !== "run.txt" &&
        !/^\d{8}-\d{6}_\.txt$/.test(fileName)
      );
    });

    if (invalidFiles.length > 0) {
      return {
        isValid: false,
        errors: [
          `Invalid files detected: ${invalidFiles.slice(0, 3).join(", ")}${invalidFiles.length > 3 ? "..." : ""}`,
        ],
      };
    }
  }

  return { isValid: true, errors: [] };
}

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
        <Label className="text-base font-medium">
          {t("experimentData.uploadModal.sensorFamily.label")}
        </Label>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("experimentData.uploadModal.sensorFamily.description")}
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
            className={sensorCardVariants({
              state: sensor.disabled ? "disabled" : "available",
            })}
            onClick={() => !sensor.disabled && onSensorSelect(sensor.id)}
            role="option"
            aria-label={`${sensor.label} sensor ${sensor.disabled ? "(disabled)" : "(available)"}`}
            aria-disabled={sensor.disabled}
          >
            <RadioGroupItem value={sensor.id} disabled={sensor.disabled} className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label className="cursor-pointer font-medium">{sensor.label}</Label>
                {sensor.disabled && (
                  <span className="bg-muted text-muted-foreground rounded px-2 py-1 text-xs">
                    Coming Soon
                  </span>
                )}
              </div>
              {sensor.description && (
                <p className="text-muted-foreground mt-1 text-sm">{sensor.description}</p>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

interface FileUploadStepProps {
  selectedFiles: FileList | null;
  onFileSelect: (files: FileList | null) => void;
  onBack: () => void;
  onUpload: () => void;
}

const FileUploadStep: React.FC<FileUploadStepProps> = ({
  selectedFiles,
  onFileSelect,
  onBack,
  onUpload,
}) => {
  const { t } = useTranslation("experiments");

  return (
    <div className={uploadStepVariants()}>
      <div>
        <Label className="text-base font-medium">
          {t("experimentData.uploadModal.fileUpload.title", "Upload Ambyte Data")}
        </Label>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("experimentData.uploadModal.fileUpload.supportedFormats")}
        </p>
      </div>

      <FileUpload
        directory={true}
        onFileSelect={onFileSelect}
        validator={validateAmbyteStructure}
        maxSize={MAX_FILE_SIZE}
        accept=".txt,.zip"
        className="w-full"
      />

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onUpload} disabled={!selectedFiles}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Data
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
        <h3 className="text-lg font-medium">{t("experimentData.uploadModal.uploading.title")}</h3>
        <p className="text-muted-foreground text-sm">
          {t("experimentData.uploadModal.uploading.description")}
        </p>
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
        <h3 className="text-lg font-medium text-green-700">
          {t("experimentData.uploadModal.success.title")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("experimentData.uploadModal.success.description")}
        </p>
      </div>

      <Button onClick={onClose} className="w-full">
        {t("experimentData.uploadModal.success.close")}
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
        <h3 className="text-destructive text-lg font-medium">
          {t("experimentData.uploadModal.error.title")}
        </h3>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">
          {t("experimentData.uploadModal.error.close")}
        </Button>
        <Button onClick={onRetry} className="flex-1">
          {t("experimentData.uploadModal.error.retry")}
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
  const {
    upload,
    isLoading,
    error: uploadError,
    data: uploadData,
    isSuccess,
    reset,
  } = useAmbyteUploadWrapper();

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

  React.useEffect(() => {
    if (isSuccess && uploadData) {
      setState((prev) => ({
        ...prev,
        step: "success",
        uploadResponse: uploadData.body,
      }));
      onUploadSuccess?.(uploadData.body);
    }
  }, [isSuccess, uploadData, onUploadSuccess]);

  React.useEffect(() => {
    if (uploadError) {
      setState((prev) => ({
        ...prev,
        step: "error",
        error: "Upload failed",
      }));
    }
  }, [uploadError]);

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

  const handleFileSelect = (files: FileList | null) => {
    setState((prev) => ({
      ...prev,
      selectedFiles: files,
      error: null,
    }));
  };

  const handleUpload = async () => {
    if (!state.selectedFiles) return;

    try {
      await upload({ experimentId, files: state.selectedFiles });
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const handleClose = () => {
    setState({
      step: "sensor-selection",
      selectedSensor: null,
      selectedFiles: null,
      uploadProgress: 0,
      error: null,
      uploadResponse: null,
    });
    reset(); // Reset the upload hook
    onOpenChange(false);
  };

  const handleRetry = () => {
    setState((prev) => ({
      ...prev,
      step: "sensor-selection",
      selectedFiles: null,
      error: null,
    }));
    reset(); // Reset the upload hook
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
            selectedFiles={state.selectedFiles}
            onFileSelect={handleFileSelect}
            onBack={handleRetry}
            onUpload={handleUpload}
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
          <DialogTitle>{t("experimentData.uploadModal.title")}</DialogTitle>
          <DialogDescription>Upload sensor data to your experiment for analysis</DialogDescription>
        </DialogHeader>

        {renderCurrentStep()}
      </DialogContent>
    </Dialog>
  );
}
