"use client";

import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

import { FileUploadStep } from "./steps/file-upload-step";
import { SensorSelectionStep, SENSOR_FAMILIES } from "./steps/sensor-selection-step";
import type { SensorFamily } from "./steps/sensor-selection-step";
import { SuccessStep } from "./steps/success-step";

// Define types
type UploadStep = "sensor-selection" | "file-upload" | "success";

interface DataUploadModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataUploadModal({ experimentId, open, onOpenChange }: DataUploadModalProps) {
  const { t } = useTranslation("experiments");
  const [step, setStep] = React.useState<UploadStep>("sensor-selection");
  const [selectedSensor, setSelectedSensor] = React.useState<SensorFamily | null>(null);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      // Reset on close with a slight delay to avoid visual jumps
      const timer = setTimeout(() => {
        setStep("sensor-selection");
        setSelectedSensor(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSensorSelect = (sensorId: string) => {
    const sensor = SENSOR_FAMILIES.find((s) => s.id === sensorId);
    if (sensor && !sensor.disabled) {
      setSelectedSensor(sensor);
      setStep("file-upload");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep("sensor-selection");
  };

  const handleUploadSuccess = () => {
    setStep("success");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("uploadModal.title")}</DialogTitle>
          <DialogDescription>{t("uploadModal.description")}</DialogDescription>
        </DialogHeader>

        {step === "sensor-selection" && (
          <SensorSelectionStep
            selectedSensor={selectedSensor}
            onSensorSelect={handleSensorSelect}
          />
        )}

        {step === "file-upload" && (
          <FileUploadStep
            experimentId={experimentId}
            onBack={handleBack}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {step === "success" && <SuccessStep onClose={handleClose} />}
      </DialogContent>
    </Dialog>
  );
}
