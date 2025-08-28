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
    description: "Upload Ambyte sensor folders containing measurement data",
  },
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function validateAmbyteStructure(files: FileList): ValidationResult {
  if (files.length === 0) {
    return { isValid: false, errors: ["Please select a folder to upload"] };
  }

  const filePaths = Array.from(files).map((f) => f.webkitRelativePath || f.name);

  const errors: string[] = [];

  // Check for Ambyte_X pattern (main folder structure)
  const ambyteRootPaths = filePaths.filter((path) => /^Ambyte_\d+\//.test(path));
  const hasAmbyteRoot = ambyteRootPaths.length > 0;

  // Check for numbered folder pattern (individual ambit subfolders: 1/, 2/, 3/, 4/)
  // This can be either direct numbered folders or within Ambyte_X folders
  const numberedRootPaths = filePaths.filter(
    (path) => /^\d+\//.test(path) || /^Ambyte_\d+\/[1-4]\//.test(path),
  );
  const hasNumberedRoot = numberedRootPaths.length > 0;

  if (!hasAmbyteRoot && !hasNumberedRoot) {
    // Check if we're getting folder names without webkitRelativePath
    const folderOnlyNames = filePaths.filter(
      (path) => /^Ambyte_\d+$/.test(path) || /^\d+$/.test(path),
    );

    if (folderOnlyNames.length > 0) {
      errors.push(
        `Folder detected but contents not accessible. This might be a browser limitation. Detected: ${folderOnlyNames.join(", ")}`,
      );
    } else {
      errors.push(
        "Please select an Ambyte folder (e.g., 'Ambyte_10') or individual ambit subfolders (e.g., '1', '2', '3', '4')",
      );
    }
    return { isValid: false, errors };
  }

  // Validate Ambyte_X folder structure
  if (hasAmbyteRoot) {
    const ambyteFolder = ambyteRootPaths[0].split("/")[0];

    // Check for required root files
    const requiredRootFiles = ["ambyte_log.txt", "config.txt", "run.txt"];
    const missingRootFiles = requiredRootFiles.filter(
      (file) => !filePaths.includes(`${ambyteFolder}/${file}`),
    );

    if (missingRootFiles.length > 0) {
      errors.push(`Missing required files in ${ambyteFolder}: ${missingRootFiles.join(", ")}`);
    }

    // Check for numbered subfolders
    const numberedSubfolders = filePaths
      .filter((path) => path.startsWith(`${ambyteFolder}/`) && /\/\d+\//.test(path))
      .map((path) => path.split("/")[1])
      .filter((folder, index, arr) => arr.indexOf(folder) === index);

    if (numberedSubfolders.length === 0) {
      errors.push(
        `No ambit subfolders found in ${ambyteFolder}. Expected numbered folders like '1', '2', '3', '4'`,
      );
    }
  }

  // Validate numbered folder structure (individual ambit folders)
  if (hasNumberedRoot && !hasAmbyteRoot) {
    const numberedFolders = numberedRootPaths
      .map((path) => path.split("/")[0])
      .filter((folder, index, arr) => arr.indexOf(folder) === index);

    // Check if folders are valid numbers (1-4 typically)
    const invalidNumbers = numberedFolders.filter((folder) => !/^\d+$/.test(folder));
    if (invalidNumbers.length > 0) {
      errors.push(
        `Invalid ambit folder names: ${invalidNumbers.join(", ")}. Expected numbered folders like '1', '2', '3', '4'`,
      );
    }
  }

  // Validate file types and structure
  const invalidFiles = filePaths.filter((path) => {
    const fileName = path.split("/").pop() ?? "";

    // Ignore system files
    if (fileName === ".DS_Store" || fileName.startsWith("._")) {
      return false; // These are valid (ignored)
    }

    // Check if it's a valid .txt file
    const isValidTxtFile =
      fileName.endsWith(".txt") &&
      (fileName === "ambyte_log.txt" ||
        fileName === "config.txt" ||
        fileName === "run.txt" ||
        fileName.startsWith("LOG_") ||
        fileName === "RTC error.txt" || // Allow RTC error files
        /^\d{8}-\d{6}_\.txt$/.test(fileName)); // Timestamp files like 20250604-192743_.txt

    return !isValidTxtFile;
  });

  if (invalidFiles.length > 0) {
    const sampleInvalidFiles = invalidFiles.slice(0, 3);
    errors.push(
      `Invalid files detected: ${sampleInvalidFiles.join(", ")}${invalidFiles.length > 3 ? ` and ${invalidFiles.length - 3} more` : ""}. Only .txt files are allowed.`,
    );
  }

  // Check for measurement files in numbered folders
  if (hasAmbyteRoot || hasNumberedRoot) {
    const measurementFiles = filePaths.filter((path) => {
      const fileName = path.split("/").pop() ?? "";
      return /^\d{8}-\d{6}_\.txt$/.test(fileName);
    });

    if (measurementFiles.length === 0) {
      errors.push(
        "No measurement data files found. Expected timestamped files like '20250604-192743_.txt'",
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
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
          Select an Ambyte folder (e.g., "Ambyte_10") or individual ambit subfolders (e.g., "1",
          "2", "3", "4"). The folder should contain .txt measurement files.
        </p>
      </div>

      <FileUpload
        directory={true}
        onFileSelect={onFileSelect}
        validator={validateAmbyteStructure}
        maxSize={MAX_FILE_SIZE}
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
