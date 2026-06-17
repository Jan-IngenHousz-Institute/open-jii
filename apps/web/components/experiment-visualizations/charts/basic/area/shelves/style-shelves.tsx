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

function AreaDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function AreaPrimaryStyle({ form, flat }: ChartPanelProps) {
  return <AreaStyleSection form={form} flat={flat} />;
}

function AreaLineStyle({ form, flat }: ChartPanelProps) {
  // Area's outline + markers are styled via the line/marker controls;
  // mirrors the standalone area panel.
  return <LineStyleSection form={form} titleKey="workspace.style.lineOptions" flat={flat} />;
}

function AreaScatterSeries({ form, flat }: ChartPanelProps) {
  return (
    <MarkerStyleSection
      form={form}
      titleKey="workspace.style.scatterSeriesOptions"
      defaultTitle="Scatter series"
      flat={flat}
    />
  );
}

function AreaBarSeries({ form, flat }: ChartPanelProps) {
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

function AreaErrorBar({ form, flat }: ChartPanelProps) {
  return <ErrorBarStyleSection form={form} flat={flat} />;
}

function AreaReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

function AreaFacetStyle({ form, flat }: ChartPanelProps) {
  return <FacetStyleSection form={form} flat={flat} />;
}

export const areaStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: AreaDisplay,
  },
  {
    key: "area",
    labelKey: "workspace.style.areaOptions",
    icon: AreaChart,
    Component: AreaPrimaryStyle,
  },
  {
    key: "line",
    labelKey: "workspace.style.lineOptions",
    icon: Spline,
    Component: AreaLineStyle,
  },
  {
    key: "scatter",
    labelKey: "workspace.style.scatterSeriesOptions",
    icon: Circle,
    Component: AreaScatterSeries,
    visible: (form) => hasTraceType(form, "scatter"),
  },
  {
    key: "bar",
    labelKey: "workspace.style.barSeriesOptions",
    icon: BarChart3,
    Component: AreaBarSeries,
    visible: (form) => hasTraceType(form, "bar"),
  },
  {
    key: "errorBar",
    labelKey: "workspace.style.errorBarOptions",
    icon: MoveVertical,
    Component: AreaErrorBar,
    visible: hasAnyErrorColumn,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: AreaReferenceLines,
  },
  {
    key: "facet",
    labelKey: "workspace.style.facetOptions",
    icon: LayoutGrid,
    Component: AreaFacetStyle,
    visible: hasFacetSource,
  },
];
