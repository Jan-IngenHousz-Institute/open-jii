"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Info,
  X,
} from "lucide-react";
import { useState } from "react";

import type { OutputCell as OutputCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useTranslation } from "@repo/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

import type { ChartClickHandler } from "./output-cell-charts";
import { ExpandedChart } from "./output-cell-charts";
import { renderDataTable } from "./output-cell-render-data";

interface OutputCellProps {
  cell: OutputCellType;
  onUpdate: (cell: OutputCellType) => void;
  onDelete: () => void;
  readOnly?: boolean;
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
}: {
  data: unknown;
  copy: (text: string) => Promise<void>;
  copied: boolean;
  onChartClick: ChartClickHandler;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { t } = useTranslation("workbook");
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="h-8 rounded-lg border border-[#EDF2F6] bg-[#F7F8FA] p-0.5">
        <TabsTrigger
          value="table"
          className="rounded-md px-3 py-1 text-xs font-medium text-[#68737B] data-[state=active]:bg-white data-[state=active]:shadow-sm"
        >
          {t("output.tabTable")}
        </TabsTrigger>
        <TabsTrigger
          value="json"
          className="rounded-md px-3 py-1 text-xs font-medium text-[#68737B] data-[state=active]:bg-white data-[state=active]:shadow-sm"
        >
          {t("output.tabJson")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="table" className="mt-2">
        {renderDataTable(data, { onChartClick, noDataLabel: t("output.noData") })}
      </TabsContent>
      <TabsContent value="json" className="mt-2">
        <div className="relative">
          <pre className="max-h-[480px] overflow-auto rounded-lg bg-[#F7F8FA] p-3 pr-12 text-xs text-[#011111]">
            {JSON.stringify(data, null, 2)}
          </pre>
          <button
            className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md border border-[#EDF2F6] bg-white text-[#68737B] shadow-sm transition-colors hover:bg-[#F7F8FA] hover:text-[#011111]"
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

export function OutputCellComponent({ cell, onUpdate, onDelete, readOnly }: OutputCellProps) {
  const { t } = useTranslation("workbook");
  const hasContent = cell.data != null || (cell.messages && cell.messages.length > 0);
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
    // when the user switches to JSON.
    if (tab !== "table") setPinnedChart(null);
  };

  return (
    <div className="group/output relative overflow-hidden rounded-b-[10px] border border-t-0 border-[#EDF2F6] bg-white">
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
            <span className="flex items-center gap-1 text-[11px] text-[#CDD5DB]">
              <Clock className="size-3" />
              {formatExecutionTime(cell.executionTime)}
            </span>
          )}
          <div className="flex-1" />
          {!readOnly && (
            <button
              className="flex size-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[#EDF2F6] group-hover/output:opacity-100"
              onClick={onDelete}
              title={t("output.clear")}
            >
              <X className="size-3 text-[#68737B]" />
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
                <span className="text-[13px] text-[#011111]">
                  {(cell.data as { answer: string }).answer}
                </span>
              </div>
            )}

            {/* Measurement / generic data */}
            {cell.data != null && !isQuestionAnswer(cell.data) && (
              <>
                <DataTabs
                  data={cell.data}
                  copy={copy}
                  copied={copied}
                  onChartClick={handleChartClick}
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
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
