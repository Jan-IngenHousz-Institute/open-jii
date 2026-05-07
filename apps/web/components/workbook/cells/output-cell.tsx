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
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { LineChart } from "@repo/ui/components/charts/line-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

type ChartClickHandler = (data: number[], columnName: string) => void;

function isNumericArray(val: unknown): val is number[] {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    val.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

function Sparkline({
  data,
  columnName,
  onClick,
}: {
  data: number[];
  columnName: string;
  onClick?: ChartClickHandler;
}) {
  const width = 80;
  const height = 24;
  const padding = 2;
  const minY = Math.min(...data);
  const maxY = Math.max(...data);
  const rangeY = maxY - minY || 1;
  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((value - minY) / rangeY) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" L ");
  const path = `M ${points}`;
  const interactive = !!onClick;
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded p-1 text-left transition-colors ${interactive ? "hover:bg-[#EDF2F6]" : "cursor-default"}`}
      onClick={() => onClick?.(data, columnName)}
      aria-label={interactive ? `Expand chart for ${columnName}` : undefined}
      disabled={!interactive}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
        <path
          d={path}
          fill="none"
          stroke="#005E5E"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[10px] tabular-nums text-[#68737B]">n={data.length}</span>
    </button>
  );
}

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

function renderCellValue(
  val: unknown,
  columnName: string,
  onChartClick?: ChartClickHandler,
): React.ReactNode {
  if (val == null) return <span className="text-[#CDD5DB]">—</span>;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-[#CDD5DB]">[]</span>;
    if (isNumericArray(val)) {
      return <Sparkline data={val} columnName={columnName} onClick={onChartClick} />;
    }
    if (typeof val[0] === "object" && val[0] !== null) return renderDataTable(val, onChartClick);
    return val.map((v) => (v == null ? "" : String(v))).join(", ");
  }
  if (typeof val === "object") return renderDataTable(val, onChartClick);
  return JSON.stringify(val);
}

function renderDataTable(data: unknown, onChartClick?: ChartClickHandler): React.ReactNode {
  if (data == null) return <p className="text-sm text-[#68737B]">No output data</p>;

  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    const keys = Array.from(
      new Set(data.flatMap((row) => Object.keys(row as Record<string, unknown>))),
    );
    return (
      <div className="overflow-auto rounded-lg border border-[#EDF2F6]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-b-[#EDF2F6] bg-[#F7F8FA]">
              {keys.map((key) => (
                <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-[#011111]">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={i < data.length - 1 ? "border-b border-b-[#EDF2F6]" : ""}>
                {keys.map((key) => (
                  <td key={key} className="px-3 py-2 align-top text-xs text-[#011111]">
                    {renderCellValue((row as Record<string, unknown>)[key], key, onChartClick)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <p className="text-sm text-[#68737B]">No output data</p>;
    return (
      <div className="overflow-auto rounded-lg border border-[#EDF2F6]">
        <table className="w-full text-xs">
          <tbody>
            {entries.map(([k, v], i) => (
              <tr key={k} className={i < entries.length - 1 ? "border-b border-b-[#EDF2F6]" : ""}>
                <th
                  scope="row"
                  className="whitespace-nowrap bg-[#F7F8FA] px-3 py-2 text-left align-top text-xs font-semibold text-[#011111]"
                >
                  {k}
                </th>
                <td className="px-3 py-2 align-top text-xs text-[#011111]">
                  {renderCellValue(v, k, onChartClick)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return <p className="px-3 py-2 text-xs text-[#011111]">{String(data)}</p>;
  }
  return <p className="px-3 py-2 text-xs text-[#011111]">{JSON.stringify(data)}</p>;
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

function ExpandedChart({
  data,
  columnName,
  onClose,
}: {
  data: number[];
  columnName: string;
  onClose: () => void;
}) {
  const plotData: LineSeriesData[] = [
    {
      name: columnName,
      x: data.map((_, idx) => idx),
      y: data,
      mode: "lines",
      line: { color: "#005E5E", width: 2 },
      showlegend: false,
    },
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#EDF2F6] bg-white">
      <div className="flex items-center justify-between border-b border-[#EDF2F6] bg-[#F7F8FA] px-3 py-1.5">
        <span className="text-xs font-semibold text-[#011111]">{columnName}</span>
        <button
          type="button"
          className="flex size-5 items-center justify-center rounded text-[#68737B] hover:bg-[#EDF2F6]"
          onClick={onClose}
          title="Close chart"
          aria-label="Close chart"
        >
          <X className="size-3" />
        </button>
      </div>
      {/* Plotly renders at ~450px when its container's height isn't propagated through the
          plotly-container div (a quirk of the shared chart wrapper). Match the experiment-data
          chart's 460px so the X-axis ticks and "Index" title aren't clipped. */}
      <div className="h-[460px] w-full px-2 pb-2 pt-1">
        <LineChart
          data={plotData}
          config={{ xAxisTitle: "Index", yAxisTitle: columnName, useWebGL: false }}
        />
      </div>
    </div>
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
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="h-8 rounded-lg border border-[#EDF2F6] bg-[#F7F8FA] p-0.5">
        <TabsTrigger
          value="table"
          className="rounded-md px-3 py-1 text-xs font-medium text-[#68737B] data-[state=active]:bg-white data-[state=active]:shadow-sm"
        >
          Table
        </TabsTrigger>
        <TabsTrigger
          value="json"
          className="rounded-md px-3 py-1 text-xs font-medium text-[#68737B] data-[state=active]:bg-white data-[state=active]:shadow-sm"
        >
          JSON
        </TabsTrigger>
      </TabsList>
      <TabsContent value="table" className="mt-2">
        {renderDataTable(data, onChartClick)}
      </TabsContent>
      <TabsContent value="json" className="mt-2">
        <div className="relative">
          <pre className="overflow-auto rounded-lg bg-[#F7F8FA] p-3 pr-12 text-xs text-[#011111]">
            {JSON.stringify(data, null, 2)}
          </pre>
          <button
            className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md border border-[#EDF2F6] bg-white text-[#68737B] shadow-sm transition-colors hover:bg-[#F7F8FA] hover:text-[#011111]"
            onClick={() => void copy(JSON.stringify(data, null, 2))}
            title="Copy JSON"
            aria-label="Copy JSON"
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
  const hasContent = cell.data != null || (cell.messages && cell.messages.length > 0);
  const toggleCollapsed = () => onUpdate({ ...cell, isCollapsed: !cell.isCollapsed });
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
      <div className={`px-4 ${cell.isCollapsed ? "py-2" : "pb-3 pt-3"}`}>
        <div
          className={cell.isCollapsed ? "flex items-center gap-2" : "mb-2 flex items-center gap-2"}
        >
          <button
            className="flex size-5 items-center justify-center rounded text-[#68737B] hover:bg-[#EDF2F6]"
            onClick={toggleCollapsed}
            title={cell.isCollapsed ? "Expand output" : "Collapse output"}
            aria-expanded={!cell.isCollapsed}
          >
            {cell.isCollapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#68737B]">
            Output
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
              title="Clear output"
            >
              <X className="size-3 text-[#68737B]" />
            </button>
          )}
        </div>

        {!cell.isCollapsed && (
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

            {!hasContent && (
              <p className="py-1 text-xs text-[#CDD5DB]">
                No measurement data available — run a protocol cell first
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
