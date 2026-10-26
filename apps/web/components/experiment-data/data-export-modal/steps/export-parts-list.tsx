"use client";

import { formatDateTime } from "@/util/date";
import { Copy, Download } from "lucide-react";
import {
  isExportExpiredError,
  useExportDownloadLinks,
} from "~/hooks/experiment/useExportDownloadLinks/useExportDownloadLinks";
import { useLocale } from "~/hooks/useLocale";
import { formatFileSize } from "~/util/format-file-size";

import type { ExperimentExportDownloadLink } from "@repo/api/domains/experiment/exports/experiment-exports.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Every file of a multi-part export with its own download, plus the links as text for a
 * download tool, since a browser asks before letting a page start many downloads at once.
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
  const locale = useLocale();
  const { data, isPending, isError, error } = useExportDownloadLinks({
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

  if (isPending) {
    return (
      <p id={id} className="text-muted-foreground text-xs">
        {t("experimentData.exportModal.loadingLinks")}
      </p>
    );
  }

  if (isError) {
    return (
      <p id={id} className="text-destructive text-xs">
        {t(
          isExportExpiredError(error)
            ? "experimentData.exportModal.linkExpired"
            : "experimentData.exportModal.linksError",
        )}
      </p>
    );
  }

  // Written straight from the click: Safari refuses a clipboard write that waits on the network,
  // and the hook already refreshes these links five minutes before they stop working.
  const handleCopyLinks = async () => {
    try {
      await navigator.clipboard.writeText(data.parts.map((part) => part.url).join("\n"));
      toast({
        description: t("experimentData.exportModal.linksCopied", {
          time: formatDateTime(data.expiresAt, locale),
        }),
      });
    } catch {
      toast({ description: t("experimentData.exportModal.copyFailed"), variant: "destructive" });
    }
  };

  return (
    <div id={id} className="space-y-2 border-t pt-2 text-xs">
      <ul className="space-y-1">{data.parts.map(renderPart)}</ul>
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {t("experimentData.exportModal.linksHint", {
            time: formatDateTime(data.expiresAt, locale),
          })}
        </p>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleCopyLinks}>
          <Copy className="h-3.5 w-3.5" />
          {t("experimentData.exportModal.copyLinks")}
        </Button>
      </div>
    </div>
  );
}
