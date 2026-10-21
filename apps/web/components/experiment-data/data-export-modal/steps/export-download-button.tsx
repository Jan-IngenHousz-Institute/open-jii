"use client";

import { orpc } from "@/lib/orpc";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import * as React from "react";
import {
  exportDownloadLinksQuery,
  isExportExpiredError,
} from "~/hooks/experiment/useExportDownloadLinks/useExportDownloadLinks";

import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Downloads a single-file export. The signed link is fetched on every click, and the browser
 * then saves the file straight from storage.
 */
export function ExportDownloadButton({
  experimentId,
  exportId,
  tableName,
}: {
  experimentId: string;
  exportId: string;
  tableName: string;
}) {
  const { t } = useTranslation("experimentData");
  const queryClient = useQueryClient();
  const [isPreparing, setIsPreparing] = React.useState(false);

  const handleDownload = async () => {
    setIsPreparing(true);

    try {
      const links = await queryClient.fetchQuery({
        ...exportDownloadLinksQuery(experimentId, exportId),
        staleTime: 0,
      });
      const part = links.parts.at(0);
      if (part) {
        window.location.assign(part.url);
      }
    } catch (error) {
      const hasExpired = isExportExpiredError(error);
      toast({
        description: t(
          hasExpired
            ? "experimentData.exportModal.linkExpired"
            : "experimentData.exportModal.linksError",
        ),
        variant: "destructive",
      });
      if (hasExpired) {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExports.queryKey({
            input: { id: experimentId, tableName },
          }),
        });
      }
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
      aria-busy={isPreparing}
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
