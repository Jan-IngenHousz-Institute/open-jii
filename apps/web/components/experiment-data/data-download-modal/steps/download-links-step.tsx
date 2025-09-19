"use client";

import { Check, Download, FileText, HardDrive, BarChart3 } from "lucide-react";
import * as React from "react";
import {
  useExperimentDataDownload,
  useDownloadFile,
} from "~/hooks/experiment/useExperimentDataDownload/useExperimentDataDownload";
import { formatFileSize } from "~/util/format-file-size";
import { formatRowCount } from "~/util/format-row-count";

import { useTranslation } from "@repo/i18n/client";
import { Button, DialogFooter } from "@repo/ui/components";

interface DownloadLinksStepProps {
  experimentId: string;
  tableName: string;
  onClose: () => void;
}

export function DownloadLinksStep({ experimentId, tableName, onClose }: DownloadLinksStepProps) {
  const { t } = useTranslation("experimentData");
  const { downloadFile } = useDownloadFile();

  const {
    data,
    error,
    isLoading: isGenerating,
  } = useExperimentDataDownload(experimentId, tableName, true);

  const externalLinks = data?.data.externalLinks ?? [];

  const handleDownloadFile = (url: string) => {
    downloadFile(url);
  };

  const handleDownloadAll = () => {
    if (externalLinks.length > 0) {
      externalLinks.forEach((link, index) => {
        setTimeout(() => {
          handleDownloadFile(link.externalLink);
        }, index * 100); // Stagger downloads slightly
      });
    }
  };

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-gray-900" />
        <span>{t("experimentData.downloadModal.generating")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
        {t("experimentData.downloadModal.error")}: {error.message}
      </div>
    );
  }

  if (externalLinks.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        {t("experimentData.downloadModal.noData")}
      </div>
    );
  }

  const totalSize = externalLinks.reduce((sum, link) => sum + link.totalSize, 0);
  const totalRows = externalLinks.reduce((sum, link) => sum + link.rowCount, 0);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
        <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {t("experimentData.downloadModal.success.title")}
          </p>
          <p className="text-sm text-green-700 dark:text-green-300">
            {t("experimentData.downloadModal.success.description", {
              count: externalLinks.length,
              totalSize: formatFileSize(totalSize),
              totalRows: formatRowCount(totalRows),
            })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("experimentData.downloadModal.downloadFiles")}
        </h4>
        <div className="space-y-2">
          {externalLinks.map((link, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t("experimentData.downloadModal.fileChunk", {
                      tableName,
                      chunkNumber: index + 1,
                      totalChunks: externalLinks.length,
                    })}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      <span>{formatFileSize(link.totalSize)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      <span>
                        {formatRowCount(link.rowCount)} {t("experimentData.downloadModal.rows")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadFile(link.externalLink)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          {t("common.close")}
        </Button>
        <Button onClick={handleDownloadAll} className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          {t("experimentData.downloadModal.downloadAll")}
        </Button>
      </DialogFooter>
    </div>
  );
}
