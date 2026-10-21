"use client";

import { Ban, LockOpen, MoreHorizontal } from "lucide-react";
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

/** What an experiment's admins can do to a dataset that is already public. */
export function DatasetRowActions({ dataset }: { dataset: Dataset }) {
  const { t } = useTranslation("datasets");
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  const isPublic = dataset.state === "published" || dataset.state === "superseded";
  const isEmbargoed = dataset.state === "published" && dataset.access === "embargoed";

  if (!isPublic) {
    return null;
  }

  const handleWithdraw = () => setIsWithdrawOpen(true);

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
          {isEmbargoed ? (
            <DropdownMenuItem>
              <LockOpen className="mr-2 size-4" aria-hidden />
              {t("actions.openFiles")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={handleWithdraw}>
            <Ban className="mr-2 size-4" aria-hidden />
            {t("actions.withdraw")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DatasetWithdrawDialog
        dataset={dataset}
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
      />
    </>
  );
}
