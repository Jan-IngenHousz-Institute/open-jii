"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import * as React from "react";
import { exportDownloadLinksQuery } from "~/hooks/experiment/useExportDownloadLinks/useExportDownloadLinks";

import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Downloads a single-file export. The signed link is fetched on click, so it is always fresh,
 * and the browser then saves the file straight from storage.
 */
export function ExportDownloadButton({
  experimentId,
  exportId,
}: {
  experimentId: string;
  exportId: string;
}) {
  const { t } = useTranslation("experimentData");
  const queryClient = useQueryClient();
  const [isPreparing, setIsPreparing] = React.useState(false);

  const handleDownload = async () => {
    setIsPreparing(true);

    try {
      const links = await queryClient.fetchQuery(exportDownloadLinksQuery(experimentId, exportId));
      const part = links.parts.at(0);
      if (part) {
        window.location.assign(part.url);
      }
    } catch {
      toast({ description: t("experimentData.exportModal.linksError"), variant: "destructive" });
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      disabled={isPreparing}
      onClick={handleDownload}
      aria-label={t("experimentData.exportModal.downloadExport")}
    >
      {isPreparing ? (
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      ) : (
        <Download className="text-muted-foreground h-4 w-4" />
      )}
    </Button>
  );
}
