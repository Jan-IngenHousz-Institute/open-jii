import React from "react";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { AddPlotSheet } from "./add-plot-sheet";
import { ComeBackSheet } from "./come-back-sheet";
import { FieldGridSheet } from "./field-grid-sheet";
import { MeasuredPlotSheet } from "./measured-plot-sheet";
import { usePlotStepStore } from "./next-plot";
import type { ExampleLayout, LayoutSession, NextPlot } from "./next-plot";
import { PlotNode } from "./plot-node";
import { PlotPicker } from "./plot-picker";
import {
  isAddPlotOn,
  isScaffoldScreenOn,
  isSkipOn,
  isTreatmentShown,
  isWalkOn,
  scaffoldNamedPlot,
} from "./scaffold-screen";
import { SkipPlotSheet } from "./skip-plot-sheet";

interface PlotStepProps {
  layout: ExampleLayout;
  session: LayoutSession;
}

export function PlotStep({ layout, session }: PlotStepProps) {
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);
  const experimentLabel = useMeasurementFlowStore((s) => s.experimentLabel);
  const isPickerOpen = usePlotStepStore((s) => s.isPickerOpen);
  const selectedPlot = usePlotStepStore((s) => s.selectedPlot);
  const isMeasuredPromptOpen = usePlotStepStore((s) => s.isMeasuredPromptOpen);
  const isSkipSheetOpen = usePlotStepStore((s) => s.isSkipSheetOpen);
  const isComeBackOpen = usePlotStepStore((s) => s.isComeBackOpen);
  const isFieldGridOpen = usePlotStepStore((s) => s.isFieldGridOpen);
  const confirm = usePlotStepStore((s) => s.confirm);
  const openPicker = usePlotStepStore((s) => s.openPicker);
  const closePicker = usePlotStepStore((s) => s.closePicker);
  const selectPlot = usePlotStepStore((s) => s.selectPlot);
  const openMeasuredPrompt = usePlotStepStore((s) => s.openMeasuredPrompt);
  const closeMeasuredPrompt = usePlotStepStore((s) => s.closeMeasuredPrompt);
  const openSkipSheet = usePlotStepStore((s) => s.openSkipSheet);
  const closeSkipSheet = usePlotStepStore((s) => s.closeSkipSheet);
  const openComeBack = usePlotStepStore((s) => s.openComeBack);
  const closeComeBack = usePlotStepStore((s) => s.closeComeBack);
  const openFieldGrid = usePlotStepStore((s) => s.openFieldGrid);
  const closeFieldGrid = usePlotStepStore((s) => s.closeFieldGrid);
  const isAddPlotOpen = usePlotStepStore((s) => s.isAddPlotOpen);
  const openAddPlot = usePlotStepStore((s) => s.openAddPlot);
  const closeAddPlot = usePlotStepStore((s) => s.closeAddPlot);

  const isSkipAvailable = isSkipOn();
  const isFieldGridOn = isScaffoldScreenOn("e8-progress-grid");
  const canAddPlot = isAddPlotOn();
  const selected = layout.field.plots.find((plot) => plot.identifier === selectedPlot);
  const namedPlot = scaffoldNamedPlot(layout);

  const confirmPlot = (plot: NextPlot) => confirm(iterationCount, plot);
  const confirmNamedPlot = () => confirmPlot(namedPlot);

  const measurePicked = (plot: NextPlot) => {
    const isAlreadyMeasured = session.stateOf(plot.identifier) === "measured";
    if (isAlreadyMeasured) {
      openMeasuredPrompt();
      return;
    }
    confirmPlot(plot);
  };

  const measureSelectedAgain = () => {
    if (selected) {
      confirmPlot(selected);
    }
  };

  const measureComeBackPlot = (identifier: string) => {
    const plot = layout.field.plots.find((candidate) => candidate.identifier === identifier);
    closeComeBack();
    if (plot) {
      confirmPlot(plot);
    }
  };

  return (
    <>
      {isPickerOpen ? (
        <PlotPicker
          field={layout.field}
          namedPlot={namedPlot}
          session={session}
          selectedPlot={selectedPlot}
          onSelect={selectPlot}
          onMeasure={measurePicked}
          onCancel={closePicker}
          onAddPlot={canAddPlot ? openAddPlot : undefined}
        />
      ) : (
        <PlotNode
          plot={namedPlot}
          session={session}
          isTreatmentShown={isTreatmentShown()}
          walk={isWalkOn() ? layout.share.walk : undefined}
          onMeasure={confirmNamedPlot}
          onAtAnotherPlot={openPicker}
          onCannotMeasure={isSkipAvailable ? openSkipSheet : undefined}
          onComeBack={isSkipAvailable ? openComeBack : undefined}
          onShowFieldGrid={isFieldGridOn ? openFieldGrid : undefined}
        />
      )}

      {canAddPlot ? (
        <AddPlotSheet isOpen={isAddPlotOpen} onAdd={closeAddPlot} onClose={closeAddPlot} />
      ) : null}

      {selected ? (
        <MeasuredPlotSheet
          plot={selected.identifier}
          measuredAt={session.measuredAt(selected.identifier)}
          isOpen={isMeasuredPromptOpen}
          onMeasureAgain={measureSelectedAgain}
          onClose={closeMeasuredPrompt}
        />
      ) : null}

      {isSkipAvailable ? (
        <>
          <SkipPlotSheet
            plot={namedPlot}
            isOpen={isSkipSheetOpen}
            onChoose={closeSkipSheet}
            onClose={closeSkipSheet}
          />
          <ComeBackSheet
            skipped={session.skipped}
            isOpen={isComeBackOpen}
            onMeasure={measureComeBackPlot}
            onClose={closeComeBack}
          />
        </>
      ) : null}

      {isFieldGridOn ? (
        <FieldGridSheet
          layout={layout}
          session={session}
          experimentName={experimentLabel ?? ""}
          isOpen={isFieldGridOpen}
          onClose={closeFieldGrid}
        />
      ) : null}
    </>
  );
}
