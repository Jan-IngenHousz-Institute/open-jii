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

function BarDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function BarPrimaryStyle({ form, flat }: ChartPanelProps) {
  return <BarStyleSection form={form} flat={flat} />;
}

function BarLineSeries({ form, flat }: ChartPanelProps) {
  return (
    <LineStyleSection
      form={form}
      titleKey="workspace.style.lineSeriesOptions"
      defaultTitle="Line series"
      flat={flat}
    />
  );
}

function BarScatterSeries({ form, flat }: ChartPanelProps) {
  return (
    <MarkerStyleSection
      form={form}
      titleKey="workspace.style.scatterSeriesOptions"
      defaultTitle="Scatter series"
      flat={flat}
    />
  );
}

function BarAreaSeries({ form, flat }: ChartPanelProps) {
  return (
    <AreaStyleSection
      form={form}
      titleKey="workspace.style.areaSeriesOptions"
      defaultTitle="Area series"
      flat={flat}
    />
  );
}

function BarErrorBar({ form, flat }: ChartPanelProps) {
  return <ErrorBarStyleSection form={form} flat={flat} />;
}

function BarReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

function BarFacetStyle({ form, flat }: ChartPanelProps) {
  return <FacetStyleSection form={form} flat={flat} />;
}

export const barStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: BarDisplay,
  },
  {
    key: "bar",
    labelKey: "workspace.style.barOptions",
    icon: BarChart3,
    Component: BarPrimaryStyle,
  },
  {
    key: "line",
    labelKey: "workspace.style.lineSeriesOptions",
    icon: Spline,
    Component: BarLineSeries,
    visible: (form) => hasTraceType(form, "line"),
  },
  {
    key: "scatter",
    labelKey: "workspace.style.scatterSeriesOptions",
    icon: Circle,
    Component: BarScatterSeries,
    visible: (form) => hasTraceType(form, "scatter"),
  },
  {
    key: "area",
    labelKey: "workspace.style.areaSeriesOptions",
    icon: AreaChart,
    Component: BarAreaSeries,
    visible: (form) => hasTraceType(form, "area"),
  },
  {
    key: "errorBar",
    labelKey: "workspace.style.errorBarOptions",
    icon: MoveVertical,
    Component: BarErrorBar,
    visible: hasAnyErrorColumn,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: BarReferenceLines,
  },
  {
    key: "facet",
    labelKey: "workspace.style.facetOptions",
    icon: LayoutGrid,
    Component: BarFacetStyle,
    visible: hasFacetSource,
  },
];
