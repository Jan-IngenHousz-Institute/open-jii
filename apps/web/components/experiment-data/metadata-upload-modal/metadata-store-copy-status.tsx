import { AlertTriangle, Loader2, RotateCw } from "lucide-react";

import type { MetadataStoreCopy } from "@repo/api/domains/experiment/metadata/experiment-metadata.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";

interface MetadataStoreCopyStatusProps {
  storeCopy: MetadataStoreCopy | null | undefined;
  isRetrying: boolean;
  onRetry: () => void;
}

/** Says when the data table cannot use a sheet yet; a sheet it can use needs no word. */
export function MetadataStoreCopyStatus({
  storeCopy,
  isRetrying,
  onRetry,
}: MetadataStoreCopyStatusProps) {
  const { t } = useTranslation("experiments");

  if (storeCopy === "pending") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("uploadModal.metadata.storeCopy.pending")}
      </span>
    );
  }

  if (storeCopy === "failed") {
    return (
      <span className="text-destructive inline-flex items-center gap-2 text-xs">
        <AlertTriangle className="h-3 w-3" />
        {t("uploadModal.metadata.storeCopy.failed")}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <RotateCw className="mr-1 h-3 w-3" />
          {t("uploadModal.metadata.storeCopy.retry")}
        </Button>
      </span>
    );
  }

  return null;
}
