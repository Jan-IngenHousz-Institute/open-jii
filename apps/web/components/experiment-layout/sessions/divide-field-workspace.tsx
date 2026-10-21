"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type {
  DivideFieldBody,
  FieldAssignments,
  FieldShare,
  FieldSplit,
  Measurer,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { zDivideFieldBody } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";

import { DivideFieldPanel } from "./divide-field-panel";
import type { FieldPlan } from "./field-plan";
import { FieldShares } from "./field-shares";
import { ReplacePaintedDialog } from "./replace-painted-dialog";
import type { WalkPaint } from "./walk-grid-cell";
import { WalkingOrderCard } from "./walking-order-card";
import { WalkingOrderPreview } from "./walking-order-preview";
import { WalkingOrderSummary } from "./walking-order-summary";

interface DivideFieldWorkspaceProps {
  plan: FieldPlan;
  canEdit: boolean;
  measurers: Measurer[];
  /** Null until the field is first divided. */
  assignments: FieldAssignments | null;
}

/** The Walking order view once a field is divided: shares on the grid, the panel beside it. */
export function DivideFieldWorkspace({
  plan,
  canEdit,
  measurers,
  assignments,
}: DivideFieldWorkspaceProps) {
  const initialIds =
    assignments?.shares.map((share) => share.userId) ??
    measurers.map((measurer) => measurer.userId);
  const initialSplit: FieldSplit = assignments?.split ?? "equalShares";

  const form = useForm<DivideFieldBody>({
    resolver: zodResolver(zDivideFieldBody),
    defaultValues: {
      measurerIds: initialIds,
      split: initialSplit,
      shares: assignments?.shares ?? plan.split(initialSplit, initialIds),
    },
  });

  const [isEditingStrategy, setIsEditingStrategy] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [paintInto, setPaintInto] = useState<string | null>(null);
  // Plots painted since the pointer went down; null while no stroke is in progress.
  const [stroke, setStroke] = useState<string[] | null>(null);
  const [history, setHistory] = useState<FieldShare[][]>([]);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);

  const shares = new FieldShares(form.watch("shares"), measurers);
  const hasOtherMembers = measurers.length > 1;
  const canPaint = canEdit && isPainting && paintInto !== null;
  const hasPainted = history.length > 0;

  const setShares = (next: FieldShare[]) => {
    form.setValue("shares", next, { shouldDirty: true });
  };

  const paintPlot = (unitId: string) => {
    if (paintInto !== null) {
      setShares(new FieldShares(form.getValues("shares"), measurers).paint([unitId], paintInto));
    }
  };

  const remember = () => {
    setHistory([...history, form.getValues("shares")]);
  };

  const handleStrokeStart = (unitId: string) => {
    remember();
    setStroke([unitId]);
    paintPlot(unitId);
  };

  const handleStrokeEnter = (unitId: string) => {
    const isNewInStroke = stroke !== null && !stroke.includes(unitId);
    if (isNewInStroke) {
      setStroke([...stroke, unitId]);
      paintPlot(unitId);
    }
  };

  const handleStrokeEnd = () => {
    setStroke(null);
  };

  const handlePaintPlot = (unitId: string) => {
    remember();
    paintPlot(unitId);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (previous !== undefined) {
      setShares(previous);
      setHistory(history.slice(0, -1));
    }
  };

  const recut = (split: FieldSplit, userIds: readonly string[]) => {
    setShares(plan.split(split, userIds));
    setHistory([]);
  };

  const reset = () => {
    recut(form.getValues("split"), form.getValues("measurerIds"));
  };

  // Scaffold: drawing a new order code is not built yet, so only the confirmation is.
  const regenerate = () => {
    if (hasPainted) {
      setIsReplaceOpen(true);
    }
  };

  const confirmReplace = () => {
    setIsReplaceOpen(false);
    reset();
  };

  const editStrategy = () => {
    setIsEditingStrategy(true);
  };

  const paint: WalkPaint | undefined = canPaint
    ? {
        stroke: stroke ?? [],
        onStrokeStart: handleStrokeStart,
        onStrokeEnter: handleStrokeEnter,
        onStrokeEnd: handleStrokeEnd,
        onPaintPlot: handlePaintPlot,
      }
    : undefined;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <WalkingOrderPreview
        plan={plan}
        showsOrder={plan.hasOrder}
        canEdit={canEdit}
        onRegenerate={regenerate}
        shares={hasOtherMembers ? shares : undefined}
        paint={paint}
      />
      <div className="space-y-6">
        {isEditingStrategy ? (
          <WalkingOrderCard plan={plan} canEdit={canEdit} />
        ) : (
          <WalkingOrderSummary plan={plan} onChange={canEdit ? editStrategy : undefined} />
        )}
        <DivideFieldPanel
          form={form}
          plan={plan}
          canEdit={canEdit}
          measurers={measurers}
          shares={shares}
          hasOtherMembers={hasOtherMembers}
          isPainting={isPainting}
          onPaintingChange={setIsPainting}
          paintInto={paintInto}
          onPaintIntoChange={setPaintInto}
          canUndo={hasPainted}
          onUndo={undo}
          onReset={reset}
          onRecut={recut}
        />
      </div>
      <ReplacePaintedDialog
        open={isReplaceOpen}
        onOpenChange={setIsReplaceOpen}
        onConfirm={confirmReplace}
      />
    </div>
  );
}
