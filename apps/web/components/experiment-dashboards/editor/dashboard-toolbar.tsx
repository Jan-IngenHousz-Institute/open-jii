"use client";

import { Database, MoreHorizontal, Palette, Sliders, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { DashboardWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Separator } from "@repo/ui/components/separator";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

import type { DashboardFormValues } from "../dashboard-form-shell";
import { widgetMetaFor } from "../widgets/widget-meta";
import { compactWidgets } from "./canvas/dashboard-grid-helpers";
import { useDashboardEditor } from "./context/dashboard-editor-context";
import { ComingSoonStrip } from "./inspector-toolbar/strips/coming-soon-strip";
import { FilterDataStrip } from "./inspector-toolbar/strips/filter-data-strip";
import { FilterWidgetStrip } from "./inspector-toolbar/strips/filter-widget-strip";
import { TableDataStrip } from "./inspector-toolbar/strips/table-data-strip";
import { TableWidgetStrip } from "./inspector-toolbar/strips/table-widget-strip";
import { VisualizationStripsHost } from "./inspector-toolbar/strips/visualization-strips-host";
import { VisualizationWidgetStrip } from "./inspector-toolbar/strips/visualization-widget-strip";
import { ToolbarShell } from "./toolbar-shell";

interface DashboardToolbarProps {
  visible: boolean;
  experimentId: string;
}

type InspectorSectionKey = "widget" | "data" | "style";

interface InspectorSection {
  key: InspectorSectionKey;
  labelKey: string;
  icon: LucideIcon;
}

const WIDGET_SECTION: InspectorSection = {
  key: "widget",
  labelKey: "editor.inspector.tabs.widget",
  icon: Sliders,
};
const DATA_SECTION: InspectorSection = {
  key: "data",
  labelKey: "editor.inspector.tabs.data",
  icon: Database,
};
const STYLE_SECTION: InspectorSection = {
  key: "style",
  labelKey: "editor.inspector.tabs.style",
  icon: Palette,
};

// Style strip is suppressed for table/filter/richText: no meaningful
// per-widget style overrides planned for those types.
const SECTIONS_BY_WIDGET: Record<DashboardWidget["type"], InspectorSection[]> = {
  visualization: [WIDGET_SECTION, DATA_SECTION, STYLE_SECTION],
  table: [WIDGET_SECTION, DATA_SECTION],
  filter: [WIDGET_SECTION, DATA_SECTION],
  richText: [],
};

// Inspector toolbar shown when a widget is selected.
// Default-exported for next/dynamic: strips drag-import Plotly.
export default function DashboardToolbar({ visible, experimentId }: DashboardToolbarProps) {
  const { t } = useTranslation("experimentDashboards");
  const { selectedWidgetId, selectWidget } = useDashboardEditor();
  const form = useFormContext<DashboardFormValues>();
  const widgets = useWatch({ control: form.control, name: "widgets" });

  const widgetIndex = selectedWidgetId ? widgets.findIndex((w) => w.id === selectedWidgetId) : -1;
  const widget = widgetIndex >= 0 ? widgets[widgetIndex] : null;

  const sections = widget ? SECTIONS_BY_WIDGET[widget.type] : [];
  const hasSections = sections.length > 1;
  const [activeSection, setActiveSection] = useState<InspectorSectionKey>("widget");

  // Reset to "widget" on selection swap so the active key always exists
  // in the new section list.
  useEffect(() => {
    setActiveSection("widget");
  }, [selectedWidgetId]);

  const handleRemove = () => {
    if (!widget) {
      return;
    }
    selectWidget(null);

    // Compact the remaining widgets so the gap left by the deleted one closes.
    // Without this, RGL visually re-flows the widgets but the form keeps the
    // pre-delete layout positions and autosave persists the stale layout.
    const layout = form.getValues("layout");
    const remaining = widgets.filter((w) => w.id !== widget.id);
    form.setValue("widgets", compactWidgets(remaining, layout.columns), {
      shouldDirty: true,
    });
  };

  const meta = widget ? widgetMetaFor(widget.type) : null;
  const metaLabel = meta ? t(meta.labelKey) : "";

  return (
    <TooltipProvider delayDuration={200}>
      <ToolbarShell visible={visible}>
        {widget && meta && (
          <>
            <div
              aria-label={metaLabel}
              className="bg-primary text-primary-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-full"
            >
              <meta.icon className="size-4" />
            </div>

            {hasSections && (
              <>
                <Separator orientation="vertical" className="mx-0.5 h-5" />
                <div className="bg-muted/60 inline-flex items-center rounded-full p-0.5">
                  {sections.map((section) => (
                    <SectionTab
                      key={section.key}
                      section={section}
                      isActive={activeSection === section.key}
                      onSelect={setActiveSection}
                      label={t(section.labelKey)}
                    />
                  ))}
                </div>
                <Separator orientation="vertical" className="mx-0.5 h-5" />
                {/* min-w-0 + flex-1 so StripOverflowList measures against
                    the shrunk toolbar width when max-w-full caps it. */}
                <div className="relative flex min-w-0 flex-1 items-center gap-0.5">
                  <ActiveStrip
                    widget={widget}
                    widgetIndex={widgetIndex}
                    experimentId={experimentId}
                    section={activeSection}
                    onAfterCreateVisualization={() => setActiveSection("data")}
                  />
                </div>
                <Separator orientation="vertical" className="mx-0.5 h-5" />
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("editor.inspector.more")}
                  className="text-muted-foreground hover:text-foreground size-9 rounded-full"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem onClick={handleRemove} className="text-destructive">
                  <Trash2 className="size-4" />
                  {t("editor.inspector.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </ToolbarShell>
    </TooltipProvider>
  );
}

interface ActiveStripProps {
  widget: DashboardWidget;
  widgetIndex: number;
  experimentId: string;
  section: InspectorSectionKey;
  onAfterCreateVisualization: () => void;
}

function ActiveStrip({
  widget,
  widgetIndex,
  experimentId,
  section,
  onAfterCreateVisualization,
}: ActiveStripProps) {
  if (widget.type === "visualization") {
    if (section === "widget") {
      return (
        <VisualizationWidgetStrip
          widget={widget}
          widgetIndex={widgetIndex}
          experimentId={experimentId}
          onAfterCreate={onAfterCreateVisualization}
        />
      );
    }
    return (
      <VisualizationStripsHost
        visualizationId={widget.config.visualizationId}
        experimentId={experimentId}
        section={section}
      />
    );
  }
  if (widget.type === "table") {
    if (section === "widget") {
      return <TableWidgetStrip widget={widget} widgetIndex={widgetIndex} />;
    }
    if (section === "data") {
      return (
        <TableDataStrip widget={widget} widgetIndex={widgetIndex} experimentId={experimentId} />
      );
    }
    return <ComingSoonStrip />;
  }
  if (widget.type === "filter") {
    if (section === "widget") {
      return <FilterWidgetStrip widget={widget} widgetIndex={widgetIndex} />;
    }
    if (section === "data") {
      return (
        <FilterDataStrip widget={widget} widgetIndex={widgetIndex} experimentId={experimentId} />
      );
    }
    return <ComingSoonStrip />;
  }
  return <ComingSoonStrip />;
}

interface SectionTabProps {
  section: InspectorSection;
  isActive: boolean;
  label: string;
  onSelect: (key: InspectorSectionKey) => void;
}

function SectionTab({ section, isActive, label, onSelect }: SectionTabProps) {
  const Icon = section.icon;
  const handleClick = () => onSelect(section.key);
  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={label}
      onClick={handleClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
        isActive
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
