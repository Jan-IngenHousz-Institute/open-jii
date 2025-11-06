"use client";

import { Eye } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { ChartPreview } from "./chart-preview";

interface ChartPreviewModalProps {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChartPreviewModal({
  form,
  experimentId,
  isOpen,
  onOpenChange,
}: ChartPreviewModalProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="text-primary h-5 w-5" />
            {t("preview.title")}
          </DialogTitle>
          <DialogDescription>{t("preview.description")}</DialogDescription>
        </DialogHeader>
        <div className="mt-6">
          <div className="h-[500px]">
            <ChartPreview form={form} experimentId={experimentId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
