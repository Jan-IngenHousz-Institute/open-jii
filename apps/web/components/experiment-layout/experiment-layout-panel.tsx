"use client";

import { MetadataUploadModal } from "@/components/experiment-data/metadata-upload-modal/metadata-upload-modal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type {
  ExperimentLayout,
  ExperimentLayoutSetup,
  ExperimentUnit,
  LayoutAnchor,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import {
  LAYOUT_PLOT_MATCH_TARGET,
  zExperimentLayoutSetup,
  zLayoutAnchor,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { LayoutAnchorCard } from "./layout-anchor-card";
import { LayoutColorBy } from "./layout-color-by";
import { LayoutFirstRun } from "./layout-first-run";
import { LayoutGapPainter } from "./layout-gap-painter";
import { LayoutGrid } from "./layout-grid";
import type { LayoutGridPosition } from "./layout-grid";
import { LayoutGridCell } from "./layout-grid-cell";
import { LayoutPlotGrid } from "./layout-plot-grid";
import { LayoutPlotListDialog } from "./layout-plot-list-dialog";
import { LayoutPlotPanel } from "./layout-plot-panel";
import { LayoutPlotQuestionDialog } from "./layout-plot-question-dialog";
import { LayoutPreview } from "./layout-preview";
import { LayoutSetupCard } from "./layout-setup-card";
import { LayoutSetupSummary } from "./layout-setup-summary";
import { useLayoutColoring } from "./use-layout-coloring";

interface ExperimentLayoutPanelProps {
  experimentId: string;
  canEdit: boolean;
  layout: ExperimentLayout | null;
  /** Whether the setup form is open on an experiment with no layout yet. */
  isDefining: boolean;
  onDefiningChange: (isDefining: boolean) => void;
}

type LayoutSide = { kind: "plot"; plotId: string } | { kind: "anchor" } | null;
type GridMode = "inspect" | "markGaps";

const EMPTY_ANCHOR: LayoutAnchor = {
  locationId: null,
  corner: null,
  rowEnd: null,
  rowSpacing: null,
  isFlipped: false,
};

function setupOf(layout: ExperimentLayout | null, defaultUnitName: string): ExperimentLayoutSetup {
  return {
    levelName: layout?.levelName ?? defaultUnitName,
    levelTerm: layout?.levelTerm ?? null,
    rows: layout?.rows ?? 6,
    columns: layout?.columns ?? 8,
    naming: layout?.naming ?? "rowLetter",
    firstNumber: layout?.firstNumber ?? 101,
  };
}

/** The Plots view: setting up, the grid and its modes, and the plot and anchor panels. */
export function ExperimentLayoutPanel({
  experimentId,
  canEdit,
  layout: savedLayout,
  isDefining,
  onDefiningChange,
}: ExperimentLayoutPanelProps) {
  const { t } = useTranslation("experiments");
  // No write route exists on the scaffold, so a created layout lives in this view until reload.
  const [created, setCreated] = useState<ExperimentLayout | null>(null);
  const layout = savedLayout ?? created;
  const [isPlotQuestionOpen, setIsPlotQuestionOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [side, setSide] = useState<LayoutSide>(null);
  const [mode, setMode] = useState<GridMode>("inspect");
  const [isAttributeImportOpen, setIsAttributeImportOpen] = useState(false);
  const [isPlotListOpen, setIsPlotListOpen] = useState(false);
  const coloring = useLayoutColoring(experimentId, layout);

  const form = useForm<ExperimentLayoutSetup>({
    resolver: zodResolver(zExperimentLayoutSetup),
    defaultValues: setupOf(layout, t("layout.defaultUnitName")),
  });
  const preview = new LayoutPreview(form.watch(), layout);
  const anchorForm = useForm<LayoutAnchor>({
    resolver: zodResolver(zLayoutAnchor),
    defaultValues: layout?.anchor ?? EMPTY_ANCHOR,
  });

  const isSetupOpen = layout === null ? isDefining : isEditing;
  const isSideOpen = side !== null;
  const selectedPlotId = side?.kind === "plot" ? side.plotId : null;

  const openSetup = () => {
    if (layout === null) {
      onDefiningChange(true);
    } else {
      setIsEditing(true);
    }
  };

  const closeSetup = () => {
    onDefiningChange(false);
    setIsEditing(false);
    form.reset();
  };

  const saveSetup = () => {
    if (layout === null) {
      setCreated(preview.layout);
      setIsPlotQuestionOpen(true);
    }
    onDefiningChange(false);
    setIsEditing(false);
  };

  const selectPlot = (unit: ExperimentUnit) => {
    setSide({ kind: "plot", plotId: unit.id });
  };

  const openAnchor = () => {
    setSide({ kind: "anchor" });
  };

  const closeSide = () => {
    setSide(null);
  };

  const startMarkingGaps = () => {
    setSide(null);
    setMode("markGaps");
  };

  const stopMarkingGaps = () => {
    setMode("inspect");
  };

  const openAttributeImport = () => {
    setIsAttributeImportOpen(true);
  };

  const openPlotList = () => {
    setIsPlotListOpen(true);
  };

  const renderPreviewCell = ({ unit }: LayoutGridPosition) => (
    <LayoutGridCell unit={unit} isSelected={false} />
  );

  if (layout === null && !isDefining) {
    return <LayoutFirstRun onDefine={canEdit ? openSetup : undefined} />;
  }

  if (isSetupOpen || layout === null) {
    return (
      <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <LayoutSetupCard
          form={form}
          preview={preview}
          mode={layout === null ? "create" : "edit"}
          onSubmit={saveSetup}
          onCancel={closeSetup}
          onPasteList={openPlotList}
        />
        <LayoutGrid
          layout={preview.layout}
          title={t("layout.preview.title")}
          description={t("layout.preview.description")}
          renderCell={renderPreviewCell}
        />
        <LayoutPlotListDialog
          levelName={preview.layout.levelName}
          open={isPlotListOpen}
          onOpenChange={setIsPlotListOpen}
        />
      </div>
    );
  }

  const isMarkingGaps = mode === "markGaps";

  return (
    <div className="space-y-6">
      <LayoutSetupSummary layout={layout} onEdit={canEdit ? openSetup : undefined} />

      <div
        className={cn("grid items-start gap-6", isSideOpen && "xl:grid-cols-[minmax(0,1fr)_340px]")}
      >
        {isMarkingGaps ? (
          <LayoutGapPainter layout={layout} onDone={stopMarkingGaps} />
        ) : (
          <LayoutPlotGrid
            layout={layout}
            selectedPlotId={selectedPlotId}
            onSelectPlot={selectPlot}
            coloring={coloring.active}
            colorBy={coloring.hasAttributes ? <LayoutColorBy coloring={coloring} /> : null}
            actions={
              canEdit
                ? {
                    onMarkGaps: startMarkingGaps,
                    onAnchor: openAnchor,
                    onAddAttributes: openAttributeImport,
                  }
                : {}
            }
          />
        )}
        {side?.kind === "plot" ? (
          <LayoutPlotPanel
            experimentId={experimentId}
            plotId={side.plotId}
            canEdit={canEdit}
            onClose={closeSide}
          />
        ) : null}
        {side?.kind === "anchor" ? (
          <LayoutAnchorCard
            experimentId={experimentId}
            layout={layout}
            form={anchorForm}
            onClose={closeSide}
          />
        ) : null}
      </div>

      <MetadataUploadModal
        experimentId={experimentId}
        open={isAttributeImportOpen}
        onOpenChange={setIsAttributeImportOpen}
        matchTarget={LAYOUT_PLOT_MATCH_TARGET}
      />
      <LayoutPlotQuestionDialog
        experimentId={experimentId}
        levelName={layout.levelName}
        open={isPlotQuestionOpen}
        onOpenChange={setIsPlotQuestionOpen}
      />
    </div>
  );
}
