"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type {
  DivideFieldBody,
  FieldAssignments,
  Measurer,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { zDivideFieldBody } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";

import { DivideFieldPanel } from "./divide-field-panel";
import type { FieldPlan } from "./field-plan";
import { FieldShares } from "./field-shares";
import { ShareGrid } from "./share-grid";

interface DivideFieldWorkspaceProps {
  plan: FieldPlan;
  measurers: Measurer[];
  assignments: FieldAssignments;
}

export function DivideFieldWorkspace({ plan, measurers, assignments }: DivideFieldWorkspaceProps) {
  const form = useForm<DivideFieldBody>({
    resolver: zodResolver(zDivideFieldBody),
    defaultValues: {
      measurerIds: assignments.shares.map((share) => share.userId),
      split: assignments.split,
      shares: assignments.shares,
    },
  });

  const [isPainting, setIsPainting] = useState(false);
  const [paintInto, setPaintInto] = useState<string | null>(null);
  // Plots painted since the pointer went down; null while no stroke is in progress.
  const [stroke, setStroke] = useState<string[] | null>(null);

  const shares = new FieldShares(form.watch("shares"));
  const canPaint = isPainting && paintInto !== null;

  const paint = (unitId: string) => {
    if (paintInto === null) {
      return;
    }
    const painted = new FieldShares(form.getValues("shares")).paint([unitId], paintInto);
    form.setValue("shares", painted, { shouldDirty: true });
  };

  const handleStrokeStart = (unit: ExperimentUnit) => {
    if (!canPaint) {
      return;
    }
    setStroke([unit.id]);
    paint(unit.id);
  };

  const handleStrokeEnter = (unit: ExperimentUnit) => {
    const isNewInStroke = stroke !== null && !stroke.includes(unit.id);
    if (!isNewInStroke) {
      return;
    }
    setStroke([...stroke, unit.id]);
    paint(unit.id);
  };

  const handleStrokeEnd = () => setStroke(null);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <ShareGrid
        plan={plan}
        measurers={measurers}
        shares={shares}
        stroke={stroke ?? []}
        canPaint={canPaint}
        onStrokeStart={handleStrokeStart}
        onStrokeEnter={handleStrokeEnter}
        onStrokeEnd={handleStrokeEnd}
      />
      <DivideFieldPanel
        form={form}
        plan={plan}
        measurers={measurers}
        shares={shares}
        isPainting={isPainting}
        onPaintingChange={setIsPainting}
        paintInto={paintInto}
        onPaintIntoChange={setPaintInto}
      />
    </div>
  );
}
