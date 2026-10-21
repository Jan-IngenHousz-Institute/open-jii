"use client";

import { PublishDatasetButton } from "@/components/datasets/publish-dataset-button";
import { Snowflake } from "lucide-react";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

interface PublishDatasetRowProps {
  experimentId: string;
  /** Zenodo allows one unpublished version at a time, so an open draft is resumed. */
  draft: Dataset | undefined;
  /** The steps above that hold Freeze. Publishing itself never waits for them. */
  holding: number;
}

/** The last row of the steps: Publish a dataset, always open, saying what Freeze waits for. */
export function PublishDatasetRow({ experimentId, draft, holding }: PublishDatasetRowProps) {
  const { t } = useTranslation("standards");

  const freeze = holding > 0 ? t("publish.waits", { count: holding }) : t("publish.ready");

  return (
    <li className="bg-muted/30 flex items-center gap-3 px-4 py-3">
      <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
        <Snowflake aria-hidden className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{freeze}</p>
        <p className="text-muted-foreground text-xs">{t("publish.opensNow")}</p>
      </div>

      <PublishDatasetButton experimentId={experimentId} draft={draft} />
    </li>
  );
}
