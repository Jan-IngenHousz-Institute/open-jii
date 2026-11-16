"use client";

import { useExperimentLayoutAttributes } from "@/hooks/experiment/useExperimentLayoutAttributes/useExperimentLayoutAttributes";
import { useExperimentSessionWalkingOrder } from "@/hooks/experiment/useExperimentSessionWalkingOrder/useExperimentSessionWalkingOrder";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";

import { FieldPlan } from "./sessions/field-plan";

interface LayoutMeasurerVisibilityProps {
  experimentId: string;
  canEdit: boolean;
}

/**
 * Which plot attributes the app shows measurers beside the plot's position, one switch each. The
 * blocks attribute always shows, because it helps a measurer find the plot.
 */
export function LayoutMeasurerVisibility({ experimentId, canEdit }: LayoutMeasurerVisibilityProps) {
  const { t } = useTranslation("experiments");
  const { data: attributes } = useExperimentLayoutAttributes(experimentId, true);
  const { data: walkingOrder } = useExperimentSessionWalkingOrder(experimentId);
  const [switchedOn, setSwitchedOn] = useState<ReadonlySet<string> | undefined>(undefined);

  const names = attributes?.names ?? [];
  const shown = switchedOn ?? new Set(attributes?.shownToMeasurers ?? []);
  const blocksName = walkingOrder ? FieldPlan.rolesOf(walkingOrder).blocksName : null;

  // Scaffold: storing the choice is not built yet.
  const toggle = (name: string) => (isOn: boolean) => {
    const next = new Set(shown);
    if (isOn) {
      next.add(name);
    } else {
      next.delete(name);
    }
    setSwitchedOn(next);
  };

  const renderAttribute = (name: string) => {
    const isBlocks = name === blocksName;
    const id = `show-to-measurers-${name}`;

    return (
      <div key={name} className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="flex-col items-start gap-0.5 font-normal">
          <span className="text-sm">{name}</span>
          {isBlocks ? (
            <span className="text-muted-foreground text-xs">
              {t("layout.measurers.blocksShown")}
            </span>
          ) : null}
        </Label>
        <Switch
          id={id}
          checked={isBlocks || shown.has(name)}
          onCheckedChange={toggle(name)}
          disabled={!canEdit || isBlocks}
        />
      </div>
    );
  };

  if (names.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 border-t pt-4" data-measurer-visibility>
      <div className="space-y-0.5">
        <h4 className="text-sm font-medium">{t("layout.measurers.title")}</h4>
        <p className="text-muted-foreground text-xs">{t("layout.measurers.description")}</p>
      </div>
      <div className="space-y-3">{names.map(renderAttribute)}</div>
    </div>
  );
}
