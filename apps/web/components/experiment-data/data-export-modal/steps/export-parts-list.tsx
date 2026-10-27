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

/**
 * Downloads a file in its own hidden frame, since navigating the page from one link to the next
 * can cancel a download before it starts. The frame hangs off the page, not the dialog: the
 * browser opens at most six connections to the bucket, and later files wait in their frames until
 * one frees up. A frame goes once its link has expired, when its file can no longer start.
 */
function downloadInHiddenFrame(url: string, expiresAt: string) {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.tabIndex = -1;
  // Keeps session replay from recording the signed link.
  frame.className = "ph-no-capture";
  frame.src = url;
  document.body.append(frame);

  window.setTimeout(() => frame.remove(), Date.parse(expiresAt) - Date.now());
}

/** Every file of a multi-part export with its own download, and a button that downloads them all. */
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
  const { data, isPending, isFetching, isError, error, refetch } = useExportDownloadLinks({
    experimentId,
    exportId,
  });

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

  // Fresh links give the files that wait for a connection the links' whole lifetime.
  const handleDownloadAll = async () => {
    const links = await refetch();
    // A failed refresh shows its error above the list.
    if (!links.isSuccess) {
      return;
    }

    links.data.parts.forEach((part) => downloadInHiddenFrame(part.url, links.data.expiresAt));
    toast({
      description: t("experimentData.exportModal.downloadingAll", {
        count: links.data.parts.length,
      }),
    });
  };

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

  return (
    <div id={id} className="space-y-2 border-t pt-2 text-xs">
      {/* A failed refresh keeps the links it has. */}
      {isError && <p className="text-destructive">{errorMessage}</p>}
      <ul className="space-y-1">{data.parts.map(renderPart)}</ul>
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isFetching}
          onClick={handleDownloadAll}
        >
          <Download className="h-3.5 w-3.5" />
          {t("experimentData.exportModal.downloadAll")}
        </Button>
      </div>
    </div>
  );
}
