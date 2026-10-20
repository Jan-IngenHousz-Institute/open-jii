import React from "react";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { FieldGridSheet } from "./field-grid-sheet";
import { usePlotStepStore } from "./next-plot";
import type { ExampleLayout, NextPlot } from "./next-plot";
import { PlotNode } from "./plot-node";
import { PlotPicker } from "./plot-picker";
import { isScaffoldScreenOn } from "./scaffold-screen";
import { SkipPlotSheet } from "./skip-plot-sheet";

interface PlotStepProps {
  layout: ExampleLayout;
}

export function PlotStep({ layout }: PlotStepProps) {
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);
  const experimentLabel = useMeasurementFlowStore((s) => s.experimentLabel);
  const isPickerOpen = usePlotStepStore((s) => s.isPickerOpen);
  const heldPlot = usePlotStepStore((s) => s.heldPlot);
  const isSkipSheetOpen = usePlotStepStore((s) => s.isSkipSheetOpen);
  const isFieldGridOpen = usePlotStepStore((s) => s.isFieldGridOpen);
  const confirm = usePlotStepStore((s) => s.confirm);
  const openPicker = usePlotStepStore((s) => s.openPicker);
  const closePicker = usePlotStepStore((s) => s.closePicker);
  const openSkipSheet = usePlotStepStore((s) => s.openSkipSheet);
  const closeSkipSheet = usePlotStepStore((s) => s.closeSkipSheet);
  const openFieldGrid = usePlotStepStore((s) => s.openFieldGrid);
  const closeFieldGrid = usePlotStepStore((s) => s.closeFieldGrid);

  const isSkipOn = isScaffoldScreenOn("d7-skip-plot");
  const isWalkOn = isScaffoldScreenOn("e3-route-context");
  const isFieldGridOn = isScaffoldScreenOn("e8-progress-grid");

  const confirmPlot = (plot: NextPlot) => confirm(iterationCount, plot);
  const confirmNamedPlot = () => confirmPlot(layout.namedPlot);

  return (
    <>
      {isPickerOpen ? (
        <PlotPicker
          field={layout.field}
          namedPlot={layout.namedPlot}
          measured={layout.measured}
          heldPlot={heldPlot}
          onPick={confirmPlot}
          onCancel={closePicker}
        />
      ) : (
        <PlotNode
          plot={layout.namedPlot}
          walk={isWalkOn ? layout.walk : undefined}
          onConfirm={confirmNamedPlot}
          onReject={openPicker}
          onSkip={isSkipOn ? openSkipSheet : undefined}
          onShowFieldGrid={isFieldGridOn ? openFieldGrid : undefined}
        />
      )}

      {isSkipOn ? (
        <SkipPlotSheet
          plot={layout.namedPlot}
          isOpen={isSkipSheetOpen}
          onChoose={closeSkipSheet}
          onClose={closeSkipSheet}
        />
      ) : null}

      {isFieldGridOn ? (
        <FieldGridSheet
          layout={layout}
          experimentName={experimentLabel ?? ""}
          isOpen={isFieldGridOpen}
          onClose={closeFieldGrid}
        />
      ) : null}
    </>
  );
}
