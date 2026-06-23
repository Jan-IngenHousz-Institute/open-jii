"use client";

import { BarChart3, LayoutGrid, Minus, MoveVertical, Settings2 } from "lucide-react";

import { BarStyleSection } from "../../../../workspace/style-sections/bar-style-section";
import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { ErrorBarStyleSection } from "../../../../workspace/style-sections/error-bar-style-section";
import { FacetStyleSection } from "../../../../workspace/style-sections/facet-style-section";
import { ReferenceLinesSection } from "../../../../workspace/style-sections/reference-lines-section";
import { hasAnyErrorColumn, hasFacetSource } from "../../../shelf-visibility";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function BarDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function BarPrimaryStyle({ form, flat }: ChartPanelProps) {
  return <BarStyleSection form={form} flat={flat} />;
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

// Bar exposes its own bar styling only. Sub-series trace overrides
// (line / scatter / area) use renderer-derived defaults -- no separate
// style panels here to keep the shelf focused on the chart's primary
// trace type.
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
