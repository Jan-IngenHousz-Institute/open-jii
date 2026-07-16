"use client";

import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
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
import { useState } from "react";

import type {
  OutputCell as OutputCellType,
  OutputDeviceResult,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import { useTranslation } from "@repo/i18n";
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
  error: { icon: AlertCircle, color: "#D14343", bg: "rgba(209, 67, 67, 0.06)" },
  warning: { icon: AlertCircle, color: "#D97706", bg: "rgba(217, 119, 6, 0.06)" },
  info: { icon: Info, color: "#68737B", bg: "rgba(0, 94, 94, 0.04)" },
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
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="h-8 rounded-lg border border-[#EDF2F6] bg-[#F7F8FA] p-0.5">
        <TabsTrigger
          value="table"
          className="data-[state=active]:shadow-xs rounded-md px-3 py-1 text-xs font-medium text-[#68737B] data-[state=active]:bg-white"
        >
          {t("output.tabTable")}
        </TabsTrigger>
        {showTimeseries && (
          <TabsTrigger
            value="timeseries"
            className="data-[state=active]:shadow-xs rounded-md px-3 py-1 text-xs font-medium text-[#68737B] data-[state=active]:bg-white"
          >
            {t("output.tabTimeseries")}
          </TabsTrigger>
        )}
        <TabsTrigger
          value="json"
          className="data-[state=active]:shadow-xs rounded-md px-3 py-1 text-xs font-medium text-[#68737B] data-[state=active]:bg-white"
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
          <pre className="max-h-[480px] overflow-auto rounded-lg bg-[#F7F8FA] p-3 pr-12 text-xs text-[#011111]">
            {JSON.stringify(data, null, 2)}
          </pre>
          <button
            className="shadow-xs absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md border border-[#EDF2F6] bg-white text-[#68737B] transition-colors hover:bg-[#F7F8FA] hover:text-[#011111]"
            onClick={() => void copy(JSON.stringify(data, null, 2))}
            title={t("output.copyJson")}
            aria-label={t("output.copyJson")}
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </TabsContent>
    </Tabs>
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
      className="rounded-lg border border-[#EDF2F6] p-3"
      data-testid="device-result"
      data-device-id={result.deviceId}
      data-status={failed ? "error" : "ok"}
    >
      <div className="mb-2 flex items-center gap-2">
        {failed ? (
          <AlertCircle className="size-3.5 text-[#D14343]" />
        ) : (
          <CheckCircle2 className="size-3.5 text-emerald-500" />
        )}
        <span className="text-[12px] font-semibold text-[#011111]">
          {result.deviceLabel ?? result.deviceId}
        </span>
      </div>
      {failed ? (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2"
          style={{ background: "rgba(209, 67, 67, 0.06)" }}
        >
          <span className="text-[13px] leading-[18px]" style={{ color: "#D14343" }}>
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
    <div className="group/output relative mt-1 overflow-hidden rounded-[10px] border border-[#EDF2F6] bg-white">
      <div className={`px-4 ${isCollapsed ? "py-2" : "pb-3 pt-3"}`}>
        <div className={isCollapsed ? "flex items-center gap-2" : "mb-2 flex items-center gap-2"}>
          <button
            className="flex size-5 items-center justify-center rounded text-[#68737B] hover:bg-[#EDF2F6]"
            onClick={toggleCollapsed}
            title={isCollapsed ? t("output.expand") : t("output.collapse")}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#68737B]">
            {t("output.label")}
          </span>
          {cell.executionTime != null && (
            <span className="inline-flex items-center gap-1 text-[11px] leading-none text-[#CDD5DB]">
              <Clock className="size-3" />
              <span className="leading-none">{formatExecutionTime(cell.executionTime)}</span>
            </span>
          )}
          <div className="flex-1" />
          {!readOnly && (
            <button
              className="flex size-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[#EDF2F6] group-hover/output:opacity-100"
              onClick={onDelete}
              title={t("output.clear")}
            >
              <Trash2 className="size-3 text-[#68737B]" />
            </button>
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
              <div className="flex items-center gap-2 rounded-lg bg-[#005E5E]/[0.04] px-3 py-2">
                <CheckCircle2 className="size-3.5 shrink-0 text-[#005E5E]" />
                <span className="text-[13px] text-[#011111]">{cell.data.answer}</span>
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

            {!hasContent && <p className="py-1 text-xs text-[#CDD5DB]">{t("output.empty")}</p>}
          </>
        )}
      </div>
    </div>
  );
}
