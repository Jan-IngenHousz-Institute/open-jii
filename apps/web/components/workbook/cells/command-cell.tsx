"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useLiveCapture } from "@/hooks/workbook/useLiveCapture/useLiveCapture";
import { Activity, Check, Copy, Square, Terminal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { CommandFormat } from "@repo/api/domains/experiment/experiment.schema";
import type { CommandCell as CommandCellType } from "@repo/api/domains/workbook/workbook-cells.schema";
import { validateInlineCommand } from "@repo/api/transforms/command-payload";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { buildCommandExtensions } from "../../shared/command-completions";
import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";
import type { EditorLanguage } from "../workbook-code-editor";
import { LiveCaptureChart } from "./live-capture-chart";

const FORMAT_LABELS: Record<CommandFormat, string> = {
  string: "String",
  json: "JSON",
  yaml: "YAML",
};

const FORMAT_LANGUAGE: Record<CommandFormat, EditorLanguage> = {
  string: "text",
  json: "json",
  yaml: "yaml",
};

const LIVE_DEFAULT_INTERVAL_MS = 1000;
const LIVE_MIN_INTERVAL_MS = 250;

interface CommandCellProps {
  cell: CommandCellType;
  onUpdate: (cell: CommandCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  /** One live-capture device read; absent when the host provides no device access. */
  onLiveRead?: () => Promise<unknown>;
  isDeviceConnected?: boolean;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
}

export function CommandCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  onLiveRead,
  isDeviceConnected,
  executionStatus,
  executionError,
  readOnly,
}: CommandCellProps) {
  const { copy, copied } = useCopyToClipboard();
  const { t } = useTranslation("common");
  const { t: tWorkbook } = useTranslation("workbook");
  const { format, content } = cell.payload;

  const validation = useMemo(() => validateInlineCommand({ format, content }), [format, content]);

  const [intervalMs, setIntervalMs] = useState(LIVE_DEFAULT_INTERVAL_MS);
  // The hook is unconditional; hosts without device access never render Start,
  // so this fallback read can only exist, never run.
  const fallbackRead = useCallback(() => Promise.reject(new Error("Live capture unavailable")), []);
  const live = useLiveCapture({
    read: onLiveRead ?? fallbackRead,
    intervalMs: Math.max(LIVE_MIN_INTERVAL_MS, intervalMs || LIVE_DEFAULT_INTERVAL_MS),
  });
  // Live capture loops a single scalar console command; structured JSON/YAML
  // payloads produce envelopes, not points.
  const canLiveCapture = format === "string" && !readOnly && onLiveRead !== undefined;
  const latestPoint = live.points.at(-1);

  // Known-command autocomplete + hover hints only apply to the free-text `string`
  // format; json/yaml payloads are structured, not a single command word.
  const commandExtensions = useMemo(
    () =>
      format === "string"
        ? buildCommandExtensions({
            singleLine: true,
            placeholder: t("experiments.commandPanelPlaceholder"),
            readOnly,
          })
        : undefined,
    [format, readOnly, t],
  );

  // A single-line command reads as an input, not a code block; drop the gutter.
  const commandBasicSetup = useMemo(
    () =>
      format === "string"
        ? {
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }
        : undefined,
    [format],
  );

  const update = (patch: Partial<CommandCellType["payload"]>) =>
    onUpdate({ ...cell, payload: { ...cell.payload, ...patch } });

  const nameOrContent = cell.payload.name?.trim() ? cell.payload.name : content;
  const displayName = nameOrContent.length > 0 ? nameOrContent : tWorkbook("cells.command");

  return (
    <CellWrapper
      icon={<Terminal className="h-3.5 w-3.5" />}
      label={displayName}
      accentColor="#119DA4"
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      onRun={onRun}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      forceActionsVisible={live.isCapturing}
      headerActions={
        <div className="flex items-center gap-1">
          {canLiveCapture &&
            (live.isCapturing ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={live.stop}
              >
                <Square className="h-3 w-3 fill-current" />
                {tWorkbook("cells.liveStop")}
              </Button>
            ) : (
              <>
                <Input
                  type="number"
                  min={LIVE_MIN_INTERVAL_MS}
                  step={250}
                  value={intervalMs}
                  onChange={(e) => setIntervalMs(Number(e.target.value))}
                  className="h-7 w-[76px] text-xs"
                  aria-label={tWorkbook("cells.liveIntervalMs")}
                  title={tWorkbook("cells.liveIntervalMs")}
                />
                <span title={!isDeviceConnected ? tWorkbook("cells.liveNoDevice") : undefined}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    style={{ color: "#119DA4" }}
                    disabled={!isDeviceConnected || !validation.ok}
                    onClick={live.start}
                  >
                    <Activity className="h-3 w-3" />
                    {tWorkbook("cells.live")}
                  </Button>
                </span>
              </>
            ))}
          <DocsHelpLink
            iconOnly
            path="/guide/devices-protocols/commands"
            className="h-7 w-7 justify-center"
          />
          {!readOnly ? (
            <Select value={format} onValueChange={(v) => update({ format: v as CommandFormat })}>
              <SelectTrigger className="h-7 w-[90px] text-xs" aria-label="Command format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["string", "json", "yaml"] as const).map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs uppercase text-[#68737B]">{FORMAT_LABELS[format]}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 p-0"
            onClick={() => void copy(content)}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <WorkbookCodeEditor
          value={content}
          onChange={readOnly ? undefined : (v) => update({ content: v })}
          language={FORMAT_LANGUAGE[format]}
          minHeight={format === "string" ? "44px" : readOnly ? "80px" : "120px"}
          maxHeight="400px"
          readOnly={readOnly}
          extraExtensions={commandExtensions}
          basicSetup={commandBasicSetup}
        />
        {!validation.ok ? <p className="text-xs text-red-500">{validation.error}</p> : null}
        {(live.isCapturing || live.points.length > 0) && (
          <div className="space-y-1" data-testid="live-capture-panel">
            <div className="flex items-center justify-between text-[11px] tabular-nums text-[#68737B]">
              <span>{tWorkbook("cells.liveSamples", { count: live.sampleCount })}</span>
              {latestPoint !== undefined && <span>{latestPoint.value.toFixed(2)}</span>}
            </div>
            <LiveCaptureChart points={live.points} label={content.trim() || displayName} />
          </div>
        )}
        {live.error ? <p className="text-xs text-red-500">{live.error}</p> : null}
      </div>
    </CellWrapper>
  );
}
