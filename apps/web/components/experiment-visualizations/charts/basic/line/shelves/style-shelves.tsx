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

function LineDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function LineLineStyle({ form, flat }: ChartPanelProps) {
  return <LineStyleSection form={form} flat={flat} />;
}

function LineMarkerStyle({ form, flat }: ChartPanelProps) {
  return (
    <MarkerStyleSection
      form={form}
      titleKey="workspace.style.scatterSeriesOptions"
      defaultTitle="Scatter series"
      flat={flat}
    />
  );
}

function LineBarStyle({ form, flat }: ChartPanelProps) {
  // Hide orientation: a horizontal bar inside a primarily vertical-line
  // chart has no consistent value axis to share.
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

function LineAreaStyle({ form, flat }: ChartPanelProps) {
  return (
    <AreaStyleSection
      form={form}
      titleKey="workspace.style.areaSeriesOptions"
      defaultTitle="Area series"
      flat={flat}
    />
  );
}

function LineErrorBar({ form, flat }: ChartPanelProps) {
  return <ErrorBarStyleSection form={form} flat={flat} />;
}

function LineReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

function LineFacetStyle({ form, flat }: ChartPanelProps) {
  return <FacetStyleSection form={form} flat={flat} />;
}

export const lineStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: LineDisplay,
  },
  {
    key: "line",
    labelKey: "workspace.style.lineOptions",
    icon: Spline,
    Component: LineLineStyle,
  },
  {
    key: "marker",
    labelKey: "workspace.style.scatterSeriesOptions",
    icon: Circle,
    Component: LineMarkerStyle,
    visible: (form) => hasTraceType(form, "scatter"),
  },
  {
    key: "bar",
    labelKey: "workspace.style.barSeriesOptions",
    icon: BarChart3,
    Component: LineBarStyle,
    visible: (form) => hasTraceType(form, "bar"),
  },
  {
    key: "area",
    labelKey: "workspace.style.areaSeriesOptions",
    icon: AreaChart,
    Component: LineAreaStyle,
    visible: (form) => hasTraceType(form, "area"),
  },
  {
    key: "errorBar",
    labelKey: "workspace.style.errorBarOptions",
    icon: MoveVertical,
    Component: LineErrorBar,
    visible: hasAnyErrorColumn,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: LineReferenceLines,
  },
  {
    key: "facet",
    labelKey: "workspace.style.facetOptions",
    icon: LayoutGrid,
    Component: LineFacetStyle,
    visible: hasFacetSource,
  },
];
