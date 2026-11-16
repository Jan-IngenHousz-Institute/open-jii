"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDatasetApprove } from "@/hooks/dataset/useDatasetApprove/useDatasetApprove";
import { useLocale } from "@/hooks/useLocale";
import { CheckCircle2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ReviewCheck, ReviewCheckItem } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { ReturnDatasetDialog } from "./return-dataset-dialog";
import { ReviewCheckRow } from "./review-check-row";

interface ReviewChecklistCardProps {
  datasetId: string;
  version: number;
  checklist: ReviewCheck[];
}

/** What a steward confirms, then Approve, which waits for every point, or Return with a reason. */
export function ReviewChecklistCard({ datasetId, version, checklist }: ReviewChecklistCardProps) {
  const { t } = useTranslation("datasets");
  const router = useRouter();
  const locale = useLocale();
  const [confirmed, setConfirmed] = useState<ReviewCheckItem[]>([]);
  const [isReturning, setIsReturning] = useState(false);

  const isAllConfirmed = checklist.every((check) => confirmed.includes(check.item));

  const backToQueue = () => router.push(`/${locale}/platform/datasets/review`);
  const { mutate: approve, isPending } = useDatasetApprove({ onSuccess: backToQueue });

  const handleToggle = (item: ReviewCheckItem) => {
    setConfirmed((current) =>
      current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item],
    );
  };
  const handleApprove = () => approve({ id: datasetId });
  const openReturn = () => setIsReturning(true);

  const renderCheck = (check: ReviewCheck) => (
    <ReviewCheckRow
      key={check.item}
      check={check}
      isConfirmed={confirmed.includes(check.item)}
      onToggle={handleToggle}
    />
  );

  return (
    <SettingsCard
      title={t("review.checklistTitle")}
      description={t("review.checklistDescription")}
      contentClassName="space-y-5"
      data-testid="review-checklist"
    >
      <ul className="divide-border divide-y">{checklist.map(renderCheck)}</ul>

      <div className="space-y-2">
        <Button className="w-full" onClick={handleApprove} disabled={!isAllConfirmed || isPending}>
          <CheckCircle2 className="size-4" aria-hidden />
          {t("review.approve")}
        </Button>
        <p className="text-muted-foreground text-xs">{t("review.approveDetail")}</p>
      </div>

      <Button variant="outline" className="w-full" onClick={openReturn}>
        <Undo2 className="size-4" aria-hidden />
        {t("review.return")}
      </Button>

      <ReturnDatasetDialog
        datasetId={datasetId}
        version={version}
        open={isReturning}
        onOpenChange={setIsReturning}
        onReturned={backToQueue}
      />
    </SettingsCard>
  );
}
