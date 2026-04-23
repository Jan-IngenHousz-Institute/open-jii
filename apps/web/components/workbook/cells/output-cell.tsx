"use client";

import { AlertCircle, CheckCircle2, Clock, Info, X } from "lucide-react";

import type { OutputCell as OutputCellType } from "@repo/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

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

function renderDataTable(data: unknown): React.ReactNode {
  if (data == null) return <p className="text-sm text-[#68737B]">No output data</p>;

  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    const keys = Object.keys(data[0] as Record<string, unknown>);
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
                  <td key={key} className="px-3 py-2 text-xs text-[#011111]">
                    {(() => {
                      const val = (row as Record<string, unknown>)[key] ?? "";
                      if (
                        typeof val === "string" ||
                        typeof val === "number" ||
                        typeof val === "boolean"
                      )
                        return String(val);
                      return JSON.stringify(val);
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <pre className="overflow-auto rounded-lg bg-[#F7F8FA] p-3 text-xs text-[#011111]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
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

export function OutputCellComponent({
  cell,
  onUpdate: _onUpdate,
  onDelete,
  readOnly,
}: OutputCellProps) {
  const hasContent = cell.data != null || (cell.messages && cell.messages.length > 0);

  return (
    <div className="group/output relative overflow-hidden rounded-b-[10px] border border-t-0 border-[#EDF2F6] bg-white">
      <div className="px-4 pb-3 pt-3">
        {/* Toolbar: OUTPUT label + execution time + dismiss */}
        <div className="mb-2 flex items-center gap-2">
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
          <Tabs defaultValue="table" className="w-full">
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
              {renderDataTable(cell.data)}
            </TabsContent>
            <TabsContent value="json" className="mt-2">
              <pre className="overflow-auto rounded-lg bg-[#F7F8FA] p-3 text-xs text-[#011111]">
                {JSON.stringify(cell.data, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        )}

        {!hasContent && (
          <p className="py-1 text-xs text-[#CDD5DB]">
            No measurement data available — run a protocol cell first
          </p>
        )}
      </div>
    </div>
  );
}
