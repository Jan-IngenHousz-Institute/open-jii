"use client";

import { Circle, LayoutGrid, Minus, MoveVertical, Settings2 } from "lucide-react";

import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { ErrorBarStyleSection } from "../../../../workspace/style-sections/error-bar-style-section";
import { FacetStyleSection } from "../../../../workspace/style-sections/facet-style-section";
import { MarkerStyleSection } from "../../../../workspace/style-sections/marker-style-section";
import { ReferenceLinesSection } from "../../../../workspace/style-sections/reference-lines-section";
import { hasAnyErrorColumn, hasFacetSource } from "../../../shelf-visibility";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function ScatterDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function ScatterMarker({ form, flat }: ChartPanelProps) {
  return <MarkerStyleSection form={form} titleKey="workspace.style.scatterOptions" flat={flat} />;
}

function ScatterErrorBar({ form, flat }: ChartPanelProps) {
  return <ErrorBarStyleSection form={form} flat={flat} />;
}

function ScatterReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

function ScatterFacetStyle({ form, flat }: ChartPanelProps) {
  return <FacetStyleSection form={form} flat={flat} />;
}

// Scatter exposes its own marker styling only. Sub-series trace
// overrides (line / bar / area) use whatever defaults the renderer
// derives -- no separate style panels here to keep the shelf focused
// on the chart's primary trace type.
export const scatterStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: ScatterDisplay,
  },
  {
    key: "marker",
    labelKey: "workspace.style.scatterOptions",
    icon: Circle,
    Component: ScatterMarker,
  },
  {
    key: "errorBar",
    labelKey: "workspace.style.errorBarOptions",
    icon: MoveVertical,
    Component: ScatterErrorBar,
    visible: hasAnyErrorColumn,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: ScatterReferenceLines,
  },
  {
    key: "facet",
    labelKey: "workspace.style.facetOptions",
    icon: LayoutGrid,
    Component: ScatterFacetStyle,
    visible: hasFacetSource,
  },
];
