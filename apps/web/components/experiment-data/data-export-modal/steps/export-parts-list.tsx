"use client";

import { Download } from "lucide-react";
import * as React from "react";
import {
  isExportExpiredError,
  useExportDownloadLinks,
} from "~/hooks/experiment/useExportDownloadLinks/useExportDownloadLinks";
import { formatFileSize } from "~/util/format-file-size";

import type { ExperimentExportDownloadLink } from "@repo/api/domains/experiment/exports/experiment-exports.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

interface DownloadAllRound {
  round: number;
  parts: Pick<ExperimentExportDownloadLink, "fileName" | "url">[];
}

/**
 * Every file of a multi-part export with its own download, and a button that downloads them all.
 * Each file of a "download all" loads in its own hidden frame, because navigating the page to the
 * next link can cancel the previous download before it starts.
 */
export function ExportPartsList({
  id,
  experimentId,
  exportId,
}: {
  id: string;
  experimentId: string;
  exportId: string;
}) {
  const { t } = useTranslation("experimentData");
  const { data, isPending, isError, error } = useExportDownloadLinks({
    experimentId,
    exportId,
  });
  // Kept as they were when the button was pressed: the hook refreshes the links later, and new
  // links in the frames would download every file again.
  const [downloadAll, setDownloadAll] = React.useState<DownloadAllRound | null>(null);

  // `ph-no-capture` keeps analytics from recording a signed link as a clicked URL.
  const renderPart = (part: ExperimentExportDownloadLink) => (
    <li key={part.index} className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground min-w-0 truncate" title={part.fileName}>
        {part.fileName}
      </span>
      <span className="text-muted-foreground shrink-0">{formatFileSize(part.sizeBytes)}</span>
      <Button variant="ghost" size="icon" asChild className="h-7 w-7 shrink-0">
        <a
          href={part.url}
          className="ph-no-capture"
          aria-label={t("experimentData.exportModal.downloadPart", { number: part.index + 1 })}
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </Button>
    </li>
  );

  const renderDownloadFrame = (part: DownloadAllRound["parts"][number], index: number) => (
    <iframe
      key={`${downloadAll?.round ?? 0}-${index}`}
      src={part.url}
      title={part.fileName}
      hidden
      aria-hidden
      tabIndex={-1}
    />
  );

  if (isPending) {
    return (
      <p id={id} className="text-muted-foreground text-xs">
        {t("experimentData.exportModal.loadingLinks")}
      </p>
    );
  }

  const errorMessage = t(
    isExportExpiredError(error)
      ? "experimentData.exportModal.linkExpired"
      : "experimentData.exportModal.linksError",
  );

  if (!data) {
    return (
      <p id={id} className="text-destructive text-xs">
        {errorMessage}
      </p>
    );
  }

  const handleDownloadAll = () => {
    setDownloadAll((previous) => ({
      round: (previous?.round ?? 0) + 1,
      parts: data.parts.map(({ fileName, url }) => ({ fileName, url })),
    }));
    toast({
      description: t("experimentData.exportModal.downloadingAll", { count: data.parts.length }),
    });
  };

  return (
    <div id={id} className="space-y-2 border-t pt-2 text-xs">
      {/* A failed refresh keeps the links it has, and the downloads already under way. */}
      {isError && <p className="text-destructive">{errorMessage}</p>}
      <ul className="space-y-1">{data.parts.map(renderPart)}</ul>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadAll}>
          <Download className="h-3.5 w-3.5" />
          {t("experimentData.exportModal.downloadAll")}
        </Button>
      </div>
      {downloadAll?.parts.map(renderDownloadFrame)}
    </div>
  );
}
