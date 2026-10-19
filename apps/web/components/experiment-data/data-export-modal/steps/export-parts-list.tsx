"use client";

import { Copy, Download } from "lucide-react";
import { useExportDownloadLinks } from "~/hooks/experiment/useExportDownloadLinks/useExportDownloadLinks";
import { formatFileSize } from "~/util/format-file-size";

import type { ExperimentExportDownloadLink } from "@repo/api/domains/experiment/exports/experiment-exports.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Every file of a multi-part export with its own download, plus the links as text for a
 * download manager, since a browser asks before letting a page start many downloads at once.
 */
export function ExportPartsList({
  experimentId,
  exportId,
}: {
  experimentId: string;
  exportId: string;
}) {
  const { t } = useTranslation("experimentData");
  const { data, isLoading, isError } = useExportDownloadLinks({ experimentId, exportId });

  const renderPart = (part: ExperimentExportDownloadLink) => (
    <li key={part.index} className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground min-w-0 truncate">{part.fileName}</span>
      <span className="text-muted-foreground shrink-0">{formatFileSize(part.sizeBytes)}</span>
      <Button variant="ghost" size="icon" asChild className="h-7 w-7 shrink-0">
        <a
          href={part.url}
          aria-label={t("experimentData.exportModal.downloadPart", { number: part.index + 1 })}
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </Button>
    </li>
  );

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-xs">
        {t("experimentData.exportModal.loadingLinks")}
      </p>
    );
  }

  if (isError || !data) {
    return <p className="text-destructive text-xs">{t("experimentData.exportModal.linksError")}</p>;
  }

  const handleCopyLinks = async () => {
    await navigator.clipboard.writeText(data.parts.map((part) => part.url).join("\n"));
    toast({ description: t("experimentData.exportModal.linksCopied") });
  };

  return (
    <div className="space-y-2 border-t pt-2 text-xs">
      <ul className="space-y-1">{data.parts.map(renderPart)}</ul>
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground">{t("experimentData.exportModal.linksHint")}</p>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleCopyLinks}>
          <Copy className="h-3.5 w-3.5" />
          {t("experimentData.exportModal.copyLinks")}
        </Button>
      </div>
    </div>
  );
}
