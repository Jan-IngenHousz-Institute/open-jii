"use client";

import { useExperimentLayoutAttributes } from "@/hooks/experiment/useExperimentLayoutAttributes/useExperimentLayoutAttributes";
import { useExperimentSessionWalkingOrder } from "@/hooks/experiment/useExperimentSessionWalkingOrder/useExperimentSessionWalkingOrder";
import { useState } from "react";

import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";

import { PlotCategories } from "./plot-state";
import { FieldPlan } from "./sessions/field-plan";

export interface LayoutColoring {
  hasAttributes: boolean;
  names: readonly string[];
  /** The attribute the fill carries, or null for a neutral grid. */
  colorBy: string | null;
  setColorBy: (name: string | null) => void;
  active:
    | {
        name: string;
        categories: PlotCategories;
        valueOf: (unit: ExperimentUnit) => string | undefined;
      }
    | undefined;
}

/**
 * What Color by offers on the Plots view and what the grid fills each plot with. It starts on the
 * attribute the walk balances on, and otherwise on the first attribute.
 */
export function useLayoutColoring(
  experimentId: string,
  layout: ExperimentLayout | null,
): LayoutColoring {
  const { data } = useExperimentLayoutAttributes(experimentId, layout !== null);
  const { data: walkingOrder } = useExperimentSessionWalkingOrder(experimentId);
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);

  const names = data?.names ?? [];
  const hasAttributes = names.length > 0;
  const balanceName = walkingOrder ? FieldPlan.rolesOf(walkingOrder).balanceName : null;
  const fallback =
    balanceName !== null && names.includes(balanceName) ? balanceName : (names[0] ?? null);
  const colorBy = chosen === undefined ? fallback : chosen;

  const valuesByUnit = new Map((data?.plots ?? []).map((plot) => [plot.unitId, plot.values]));

  const valueOf = (unit: ExperimentUnit) =>
    colorBy === null ? undefined : valuesByUnit.get(unit.id)?.[colorBy];

  const distinct =
    colorBy === null
      ? []
      : [...new Set((data?.plots ?? []).flatMap((plot) => plot.values[colorBy] ?? []))].sort(
          (a, b) => a.localeCompare(b, "en-US", { numeric: true }),
        );

  return {
    hasAttributes,
    names,
    colorBy,
    setColorBy: setChosen,
    active:
      colorBy === null || distinct.length === 0
        ? undefined
        : { name: colorBy, categories: new PlotCategories(distinct), valueOf },
  };
}
