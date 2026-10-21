"use client";

import { useUpdateFollowedStandards } from "@/hooks/experiment/useUpdateFollowedStandards/useUpdateFollowedStandards";
import { useState } from "react";

import { ALWAYS_FOLLOWED } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import type {
  FollowableStandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

import { StandardChoiceRow } from "./standard-choice-row";
import { canFollow } from "./use-followed-standards";

interface ChooseStandardsDialogProps {
  experimentId: string;
  standards: StandardReadiness[];
  chosen: FollowableStandardId[];
  onClose: () => void;
}

/** Every standard in plain words: the ones to follow, then the ones only shown. Nothing changes until Save. */
export function ChooseStandardsDialog({
  experimentId,
  standards,
  chosen,
  onClose,
}: ChooseStandardsDialogProps) {
  const { t } = useTranslation("standards");
  const [selection, setSelection] = useState(chosen);
  // A failed save raises the app's error toast, and the dialog stays open to try again.
  const { mutate: saveFollowed, isPending } = useUpdateFollowedStandards();

  const isAlwaysFollowed = (row: StandardReadiness) => row.standard === ALWAYS_FOLLOWED;
  const followable = [
    ...standards.filter(isAlwaysFollowed),
    ...standards.filter((row) => canFollow(row) && !isAlwaysFollowed(row)),
  ];
  const shownOnly = standards.filter((row) => !canFollow(row));

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleToggle = (standard: FollowableStandardId) => {
    setSelection((current) =>
      current.includes(standard) ? current.filter((id) => id !== standard) : [...current, standard],
    );
  };

  const handleSave = () => {
    saveFollowed({ id: experimentId, followed: selection }, { onSuccess: onClose });
  };

  const isSelected = (row: StandardReadiness) =>
    selection.some((standard) => standard === row.standard);

  const renderRow = (row: StandardReadiness) => (
    <StandardChoiceRow
      key={row.standard}
      readiness={row}
      isFollowing={isSelected(row)}
      onToggle={handleToggle}
    />
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("choose.title")}</DialogTitle>
          <DialogDescription>{t("choose.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <ul className="divide-border divide-y">{followable.map(renderRow)}</ul>

          <div className="space-y-1">
            <h3 className="text-muted-foreground text-xs font-medium">
              {t("choose.notFollowable")}
            </h3>
            <ul className="divide-border divide-y">{shownOnly.map(renderRow)}</ul>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("choose.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {t("choose.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
