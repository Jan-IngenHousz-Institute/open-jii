"use client";

import * as React from "react";
import { useExperimentDataDownload } from "~/hooks/experiment/useExperimentDataDownload/useExperimentDataDownload";

import { useTranslation } from "@repo/i18n/client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

interface DataDownloadModalProps {
  experimentId: string;
  tableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataDownloadModal({
  experimentId,
  tableName,
  open,
  onOpenChange,
}: DataDownloadModalProps) {
  const { t } = useTranslation("experiments");
  const [selectedFormat, setSelectedFormat] = React.useState<string>("csv");
  const { mutate: downloadData, isPending: isLoading, error } = useExperimentDataDownload();

  const handleDownload = () => {
    downloadData({ experimentId, tableName });
    onOpenChange(false);
  };

  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setSelectedFormat("csv");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("experimentDataTable.downloadData")}</DialogTitle>
          <DialogDescription>
            {t("experimentDataTable.downloadDescription", { tableName })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              {t("experimentDataTable.format")}
            </Label>
            <div className="col-span-3">
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {t("experimentDataTable.downloadError")}: {error.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleDownload} disabled={isLoading}>
            {isLoading ? t("experimentDataTable.downloading") : t("common.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
