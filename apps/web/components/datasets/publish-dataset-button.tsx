"use client";

import { useDatasetCreate } from "@/hooks/dataset/useDatasetCreate/useDatasetCreate";
import { useLocale } from "@/hooks/useLocale";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface PublishDatasetButtonProps {
  experimentId: string;
  /** Zenodo allows one unpublished version at a time, so an open Draft is resumed, not doubled. */
  draft: Dataset | undefined;
}

export function PublishDatasetButton({ experimentId, draft }: PublishDatasetButtonProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const router = useRouter();

  const openPublishFlow = (dataset: Dataset) => {
    router.push(`/${locale}/platform/experiments/${experimentId}/datasets/${dataset.id}/publish`);
  };

  const { mutate: createDataset, isPending } = useDatasetCreate({ onSuccess: openPublishFlow });

  const handleClick = () => {
    if (draft !== undefined) {
      openPublishFlow(draft);
      return;
    }
    createDataset({ id: experimentId });
  };

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      {t("list.publish")}
    </Button>
  );
}
