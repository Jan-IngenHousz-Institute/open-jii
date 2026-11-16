"use client";

import { useDatasetCancelReview } from "@/hooks/dataset/useDatasetCancelReview/useDatasetCancelReview";
import { Ban, LockOpen, MoreHorizontal, Undo2 } from "lucide-react";
import { useState } from "react";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { DatasetWithdrawDialog } from "./dataset-withdraw-dialog";

/** What an experiment's admins can do to a dataset that is waiting for review or already public. */
export function DatasetRowActions({ dataset }: { dataset: Dataset }) {
  const { t } = useTranslation("datasets");
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const { mutate: cancelReview, isPending: isCancelling } = useDatasetCancelReview();

  const isInReview = dataset.state === "inReview";
  const isPublic = dataset.state === "published" || dataset.state === "superseded";
  const isEmbargoed = dataset.state === "published" && dataset.access === "embargoed";

  if (!isPublic && !isInReview) {
    return null;
  }

  const handleWithdraw = () => setIsWithdrawOpen(true);
  const handleCancelReview = () => cancelReview({ id: dataset.id });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("actions.label", { version: dataset.version })}
            className="text-muted-foreground data-[state=open]:bg-accent"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isInReview ? (
            <DropdownMenuItem onSelect={handleCancelReview} disabled={isCancelling}>
              <Undo2 className="mr-2 size-4" aria-hidden />
              {t("actions.cancelReview")}
            </DropdownMenuItem>
          ) : null}
          {isEmbargoed ? (
            <DropdownMenuItem>
              <LockOpen className="mr-2 size-4" aria-hidden />
              {t("actions.openFiles")}
            </DropdownMenuItem>
          ) : null}
          {isPublic ? (
            <DropdownMenuItem variant="destructive" onSelect={handleWithdraw}>
              <Ban className="mr-2 size-4" aria-hidden />
              {t("actions.withdraw")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {isPublic ? (
        <DatasetWithdrawDialog
          dataset={dataset}
          open={isWithdrawOpen}
          onOpenChange={setIsWithdrawOpen}
        />
      ) : null}
    </>
  );
}
