"use client";

import { JsonFormatToggle } from "@/components/shared/json-format-toggle";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useJsonFormatStyle } from "@/hooks/useJsonFormatStyle";
import { formatJson } from "@/lib/json-format";
import { isMultispeqOutput } from "@/lib/multispeq/detect";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Info,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { presentDevice, resolveDevicePrimaryLabel } from "~/util/device-presentation";

import type {
  OutputCell as OutputCellType,
  OutputDeviceResult,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

import type { ChartClickHandler } from "./output-cell-charts";
import { ExpandedChart } from "./output-cell-charts";
import { renderDataTable } from "./output-cell-render-data";
import { OutputCellTimeseries } from "./output-cell-timeseries";

interface OutputCellProps {
  cell: OutputCellType;
  onUpdate: (cell: OutputCellType) => void;
  onDelete: () => void;
  readOnly?: boolean;
  allCells?: WorkbookCell[];
}

function formatExecutionTime(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getMessageType(message: string): "error" | "warning" | "info" {
  const lower = message.toLowerCase();
  if (
    lower.includes("error") ||
    lower.includes("danger") ||
    lower.includes("fail") ||
    lower.includes("invalid")
  ) {
    return "error";
  }
  if (lower.includes("warn") || lower.includes("caution")) {
    return "warning";
  }
  return "info";
}

const messageStyles = {
  error: {
    icon: AlertCircle,
    color: "var(--destructive)",
    bg: "color-mix(in srgb, var(--destructive) 8%, transparent)",
  },
  warning: {
    icon: AlertCircle,
    color: "var(--status-stale-foreground)",
    bg: "color-mix(in srgb, var(--status-stale-foreground) 8%, transparent)",
  },
  info: {
    icon: Info,
    color: "var(--muted-foreground)",
    bg: "color-mix(in srgb, var(--primary) 6%, transparent)",
  },
} as const;

function isQuestionAnswer(data: unknown): data is { answer: string } {
  return (
    data != null &&
    typeof data === "object" &&
    "answer" in data &&
    typeof (data as Record<string, unknown>).answer === "string"
  );
}

function DataTabs({
  data,
  copy,
  copied,
  onChartClick,
  activeTab,
  onTabChange,
  showTimeseries,
  protocolCode,
  protocolLoading,
}: {
  data: unknown;
  copy: (text: string) => Promise<void>;
  copied: boolean;
  onChartClick: ChartClickHandler;
  activeTab: string;
  onTabChange: (tab: string) => void;
  showTimeseries: boolean;
  protocolCode?: unknown;
  protocolLoading?: boolean;
}) {
  const { t } = useTranslation("workbook");
  const { style, toggleStyle } = useJsonFormatStyle();
  // Measurement payloads are mostly long sample arrays, so the layout matters
  // here as much as it does for protocol code. Copy takes what is on screen.
  const jsonText = useMemo(() => formatJson(data, { style }), [data, style]);
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="border-border bg-muted h-8 rounded-lg border p-0.5">
        <TabsTrigger
          value="table"
          className="data-[state=active]:shadow-xs text-muted-foreground data-[state=active]:bg-card rounded-md px-3 py-1 text-xs font-medium"
        >
          {t("output.tabTable")}
        </TabsTrigger>
        {showTimeseries && (
          <TabsTrigger
            value="timeseries"
            className="data-[state=active]:shadow-xs text-muted-foreground data-[state=active]:bg-card rounded-md px-3 py-1 text-xs font-medium"
          >
            {t("output.tabTimeseries")}
          </TabsTrigger>
        )}
        <TabsTrigger
          value="json"
          className="data-[state=active]:shadow-xs text-muted-foreground data-[state=active]:bg-card rounded-md px-3 py-1 text-xs font-medium"
        >
          {t("output.tabJson")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="table" className="mt-2">
        {renderDataTable(data, { onChartClick, noDataLabel: t("output.noData") })}
      </TabsContent>
      {showTimeseries && (
        <TabsContent value="timeseries" className="mt-2">
          <OutputCellTimeseries
            data={data}
            protocolCode={protocolCode}
            loading={protocolLoading}
            emptyLabel={t("output.timeseriesEmpty")}
            errorLabel={t("output.timeseriesError")}
          />
        </TabsContent>
      )}
      <TabsContent value="json" className="mt-2">
        <div className="relative">
          <pre className="bg-muted text-foreground max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 pr-20 text-xs">
            {jsonText}
          </pre>
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
            <JsonFormatToggle style={style} onToggle={toggleStyle} />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground size-7"
              onClick={() => void copy(jsonText)}
              title={t("output.copyJson")}
              aria-label={t("output.copyJson")}
            >
              {copied ? (
                <Check className="text-status-active-foreground size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function DeviceResultIdentity({ result }: { result: OutputDeviceResult }) {
  const { t } = useTranslation("iot");
  const presentation = presentDevice({
    // Older saved results only carried `deviceLabel`; treat that as their
    // legacy display name when no structured family/name exists.
    name: result.deviceName ?? (result.family ? undefined : result.deviceLabel),
    family: result.family,
    id: result.deviceLabel,
  });
  const primaryLabel = resolveDevicePrimaryLabel(presentation, t);
  const secondaryLabel = [
    presentation.provenance !== "product" ? presentation.productName : null,
    presentation.id,
  ]
    .filter((value): value is string => value != null && value !== primaryLabel)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" · ");

  return (
    <span className="text-foreground flex min-w-0 flex-col text-[12px] font-semibold">
      <span className="truncate">{primaryLabel}</span>
      {secondaryLabel.length > 0 && (
        <span className="text-muted-foreground truncate font-normal">{secondaryLabel}</span>
      )}
    </span>
  );
}

// One device's slice of a multi-device run: its own tab/chart state, so
// switching the JSON view on one device doesn't flip the others.
function DeviceResultBlock({
  result,
  showTimeseries,
  protocolCode,
  protocolLoading,
}: {
  result: OutputDeviceResult;
  showTimeseries: boolean;
  protocolCode?: unknown;
  protocolLoading?: boolean;
}) {
  // Own clipboard state: copying one device's JSON must not flash the
  // success icon on every other block.
  const { copy, copied } = useCopyToClipboard();
  const [activeTab, setActiveTab] = useState("table");
  const [pinnedChart, setPinnedChart] = useState<{ data: number[]; columnName: string } | null>(
    null,
  );
  const handleChartClick: ChartClickHandler = (data, columnName) => {
    setPinnedChart((prev) => (prev?.columnName === columnName ? null : { data, columnName }));
  };
  const failed = result.error != null;

  return (
    <div
      className="border-border rounded-lg border p-3"
      data-testid="device-result"
      data-device-id={result.deviceId}
      data-status={failed ? "error" : "ok"}
    >
      <div className="mb-2 flex items-center gap-2">
        {failed ? (
          <AlertCircle className="text-destructive size-3.5" />
        ) : (
          <CheckCircle2 className="text-status-active-foreground size-3.5" />
        )}
        <DeviceResultIdentity result={result} />
      </div>
      {failed ? (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2"
          style={{ background: "color-mix(in srgb, var(--destructive) 8%, transparent)" }}
        >
          <span className="text-[13px] leading-[18px]" style={{ color: "var(--destructive)" }}>
            {result.error}
          </span>
        </div>
      ) : (
        <>
          <DataTabs
            data={result.data}
            copy={copy}
            copied={copied}
            onChartClick={handleChartClick}
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab !== "table") setPinnedChart(null);
            }}
            showTimeseries={showTimeseries}
            protocolCode={protocolCode}
            protocolLoading={protocolLoading}
          />
          {pinnedChart && activeTab === "table" && (
            <ExpandedChart
              key={pinnedChart.columnName}
              data={pinnedChart.data}
              columnName={pinnedChart.columnName}
              onClose={() => setPinnedChart(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

export function OutputCellComponent({
  cell,
  onUpdate,
  onDelete,
  readOnly,
  allCells,
}: OutputCellProps) {
  const { t } = useTranslation("workbook");
  const hasContent =
    cell.data != null || (cell.messages?.length ?? 0) > 0 || (cell.deviceResults?.length ?? 0) > 0;
  // Read-only viewers can still collapse the cell for their own view, but their toggle should not
  // mutate persisted state. Keep a local override; fall back to the cell's persisted flag.
  const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null);
  const isCollapsed = readOnly && localCollapsed != null ? localCollapsed : !!cell.isCollapsed;
  const toggleCollapsed = () => {
    if (readOnly) {
      setLocalCollapsed(!isCollapsed);
    } else {
      onUpdate({ ...cell, isCollapsed: !cell.isCollapsed });
    }
  };
  const { copy, copied } = useCopyToClipboard();
  const [pinnedChart, setPinnedChart] = useState<{ data: number[]; columnName: string } | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState("table");
  const handleChartClick: ChartClickHandler = (data, columnName) => {
    setPinnedChart((prev) => (prev?.columnName === columnName ? null : { data, columnName }));
  };
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // The expanded chart only makes sense alongside the table view, so collapse it
    // when the user switches off it.
    if (tab !== "table") setPinnedChart(null);
  };

  const sourceCell = allCells?.find((c) => c.id === cell.producedBy);
  const sourceProtocolId =
    sourceCell?.type === "protocol" ? sourceCell.payload.protocolId : undefined;
  const { data: protocolResponse, isLoading: protocolLoading } = useProtocol(
    sourceProtocolId ?? "",
    !!sourceProtocolId,
  );
  const protocolFamily = protocolResponse?.family;
  const protocolCode = protocolResponse?.code;
  const showTimeseries = protocolFamily === "multispeq" && isMultispeqOutput(cell.data);

  return (
    <Card className="group/output relative mt-1 gap-0 overflow-hidden py-0">
      <div className={`px-4 ${isCollapsed ? "py-2" : "pb-3 pt-3"}`}>
        <div className={isCollapsed ? "flex items-center gap-2" : "mb-2 flex items-center gap-2"}>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:bg-muted size-5"
            onClick={toggleCollapsed}
            title={isCollapsed ? t("output.expand") : t("output.collapse")}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </Button>
          <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
            {t("output.label")}
          </span>
          {cell.executionTime != null && (
            <span className="text-muted-foreground/60 inline-flex items-center gap-1 text-[11px] leading-none">
              <Clock className="size-3" />
              <span className="leading-none">{formatExecutionTime(cell.executionTime)}</span>
            </span>
          )}
          <div className="flex-1" />
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="hover:bg-muted size-5 opacity-0 transition-opacity group-hover/output:opacity-100"
              onClick={onDelete}
              title={t("output.clear")}
            >
              <Trash2 className="text-muted-foreground size-3" />
            </Button>
          )}
        </div>

        {!isCollapsed && (
          <>
            {/* Messages */}
            {cell.messages && cell.messages.length > 0 && (
              <div className="space-y-1.5">
                {cell.messages.map((msg, i) => {
                  const type = getMessageType(msg);
                  const style = messageStyles[type];
                  const Icon = style.icon;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg px-3 py-2"
                      style={{ background: style.bg }}
                    >
                      <Icon className="mt-0.5 size-3.5 shrink-0" style={{ color: style.color }} />
                      <span className="text-[13px] leading-[18px]" style={{ color: style.color }}>
                        {msg}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Question answer */}
            {isQuestionAnswer(cell.data) && (
              <div className="bg-primary/[0.04] flex items-center gap-2 rounded-lg px-3 py-2">
                <CheckCircle2 className="text-primary size-3.5 shrink-0" />
                <span className="text-foreground text-[13px]">{cell.data.answer}</span>
              </div>
            )}

            {/* Per-device results from a multi-device run */}
            {cell.deviceResults && cell.deviceResults.length > 1 && (
              <div className="space-y-3" data-testid="device-results">
                {cell.deviceResults.map((result) => (
                  <DeviceResultBlock
                    key={result.deviceId}
                    result={result}
                    showTimeseries={
                      protocolFamily === "multispeq" && isMultispeqOutput(result.data)
                    }
                    protocolCode={protocolCode}
                    protocolLoading={protocolLoading}
                  />
                ))}
              </div>
            )}

            {/* A single run keeps its legacy primary data shape while retaining
                and presenting the same identity metadata as multi-device runs. */}
            {cell.deviceResults?.length === 1 && (
              <div data-testid="single-device-result" className="mb-2">
                <DeviceResultIdentity result={cell.deviceResults[0]} />
              </div>
            )}

            {/* Measurement / generic data */}
            {!(cell.deviceResults && cell.deviceResults.length > 1) &&
              cell.data != null &&
              !isQuestionAnswer(cell.data) && (
                <>
                  <DataTabs
                    data={cell.data}
                    copy={copy}
                    copied={copied}
                    onChartClick={handleChartClick}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    showTimeseries={showTimeseries}
                    protocolCode={protocolCode}
                    protocolLoading={protocolLoading}
                  />
                  {pinnedChart && activeTab === "table" && (
                    // Plotly reuses its plot div across re-renders; switching columns can leave the
                    // previous trace on screen. Keying on columnName forces a fresh mount.
                    <ExpandedChart
                      key={pinnedChart.columnName}
                      data={pinnedChart.data}
                      columnName={pinnedChart.columnName}
                      onClose={() => setPinnedChart(null)}
                    />
                  )}
                </>
              )}

            {!hasContent && (
              <p className="text-muted-foreground/60 py-1 text-xs">{t("output.empty")}</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
