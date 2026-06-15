"use client";

import {
  AreaChart,
  BarChart3,
  Circle,
  LayoutGrid,
  Minus,
  MoveVertical,
  Settings2,
  Spline,
} from "lucide-react";

import { AreaStyleSection } from "../../../../workspace/style-sections/area-style-section";
import { BarStyleSection } from "../../../../workspace/style-sections/bar-style-section";
import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { ErrorBarStyleSection } from "../../../../workspace/style-sections/error-bar-style-section";
import { FacetStyleSection } from "../../../../workspace/style-sections/facet-style-section";
import { LineStyleSection } from "../../../../workspace/style-sections/line-style-section";
import { MarkerStyleSection } from "../../../../workspace/style-sections/marker-style-section";
import { ReferenceLinesSection } from "../../../../workspace/style-sections/reference-lines-section";
import { hasAnyErrorColumn, hasFacetSource, hasTraceType } from "../../../shelf-visibility";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function ScatterDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function ScatterMarker({ form, flat }: ChartPanelProps) {
  return <MarkerStyleSection form={form} titleKey="workspace.style.scatterOptions" flat={flat} />;
}

function ScatterLine({ form, flat }: ChartPanelProps) {
  return <LineStyleSection form={form} flat={flat} />;
}

function ScatterBar({ form, flat }: ChartPanelProps) {
  // Hide orientation: scatter's primary axes are continuous, so a
  // horizontal bar lacks a shared value axis to flip onto.
  return (
    <BarStyleSection
      form={form}
      titleKey="workspace.style.barSeriesOptions"
      defaultTitle="Bar series"
      showOrientation={false}
      flat={flat}
    />
  );
}

function ScatterArea({ form, flat }: ChartPanelProps) {
  return (
    <AreaStyleSection
      form={form}
      titleKey="workspace.style.areaSeriesOptions"
      defaultTitle="Area series"
      flat={flat}
    />
  );
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

// Mirrors scatter/style-panel.tsx: Marker is scatter's primary section
// and Line is always mounted (covers "lines+markers" mode plus any
// line-typed series overrides). Bar/Area only surface when a Y series
// picks that trace type. ErrorBar/ReferenceLines/Facet are unconditional
// to match the standalone panel's behaviour.
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
    key: "line",
    labelKey: "workspace.style.lineOptions",
    icon: Spline,
    Component: ScatterLine,
  },
  {
    key: "bar",
    labelKey: "workspace.style.barSeriesOptions",
    icon: BarChart3,
    Component: ScatterBar,
    visible: (form) => hasTraceType(form, "bar"),
  },
  {
    key: "area",
    labelKey: "workspace.style.areaSeriesOptions",
    icon: AreaChart,
    Component: ScatterArea,
    visible: (form) => hasTraceType(form, "area"),
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
