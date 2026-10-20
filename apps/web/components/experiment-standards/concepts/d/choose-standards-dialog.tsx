"use client";

import { useState } from "react";

import type {
  ReadinessState,
  StandardId,
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

import { availabilityOf, StandardChoiceRow } from "./standard-choice-row";
import type { ChoiceAvailability } from "./standard-choice-row";

// The locked floor first, then what can be chosen, then what cannot.
const AVAILABILITY_ORDER: Record<ChoiceAvailability, number> = {
  required: 0,
  open: 1,
  "after-publishing": 2,
  "not-offered": 3,
};

// Among the choosable, the ones with work left lead and the ones that do not apply trail.
const STATE_ORDER: Record<ReadinessState, number> = {
  partial: 0,
  met: 1,
  "not-assessed": 2,
  "not-applicable": 3,
};

function choiceOrder(a: StandardReadiness, b: StandardReadiness): number {
  return (
    AVAILABILITY_ORDER[availabilityOf(a)] - AVAILABILITY_ORDER[availabilityOf(b)] ||
    STATE_ORDER[a.state] - STATE_ORDER[b.state]
  );
}

interface ChooseStandardsDialogProps {
  standards: StandardReadiness[];
  followed: StandardId[];
  onSave: (followed: StandardId[]) => void;
  onClose: () => void;
}

/** Every standard in plain words, to follow or leave. Nothing changes until Save. */
export function ChooseStandardsDialog({
  standards,
  followed,
  onSave,
  onClose,
}: ChooseStandardsDialogProps) {
  const { t } = useTranslation("readinessConceptD");
  const [chosen, setChosen] = useState(followed);

  const rows = [...standards].sort(choiceOrder);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleToggle = (standard: StandardId) => {
    setChosen((current) =>
      current.includes(standard) ? current.filter((id) => id !== standard) : [...current, standard],
    );
  };

  const handleSave = () => onSave(chosen);

  const renderRow = (readiness: StandardReadiness) => (
    <StandardChoiceRow
      key={readiness.standard}
      readiness={readiness}
      isFollowing={chosen.includes(readiness.standard)}
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

        <DialogBody>
          <ul className="divide-border divide-y">{rows.map(renderRow)}</ul>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("choose.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("choose.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
