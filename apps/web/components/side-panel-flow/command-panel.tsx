"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useMemo, useState } from "react";
import { useCommandSearch } from "~/hooks/command/useCommandSearch/useCommandSearch";

import type { Command } from "@repo/api/schemas/command.schema";
import type { CommandFormat } from "@repo/api/schemas/experiment.schema";
import { validateInlineCommand } from "@repo/api/utils/command-payload";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import { CommandSearchWithDropdown } from "../command-search-with-dropdown";
import { buildCommandExtensions } from "../shared/command-completions";
import { WorkbookCodeEditor } from "../workbook/workbook-code-editor";
import type { EditorLanguage } from "../workbook/workbook-code-editor";

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

export interface InlineCommandValue {
  format: CommandFormat;
  content: string;
}

export interface CommandPanelValue {
  commandId?: string;
  command?: InlineCommandValue;
}

type CommandMode = "library" | "inline";

interface CommandPanelProps {
  commandId?: string;
  command?: InlineCommandValue;
  onChange: (value: CommandPanelValue) => void;
  disabled?: boolean;
}

/**
 * Panel for a COMMAND flow node. A command is either a library reference
 * (search + pick, stored as `commandId`) or an inline payload (format +
 * content, stored as `command`); the mode toggle switches between them.
 */
export function CommandPanel({
  commandId,
  command,
  onChange,
  disabled = false,
}: CommandPanelProps) {
  const { t } = useTranslation("common");
  const [mode, setMode] = useState<CommandMode>(commandId ? "library" : "inline");

  // Library search state
  const [commandSearch, setCommandSearch] = useState("");
  const [debouncedCommandSearch, isDebounced] = useDebounce(commandSearch, 300);
  const { commands: commandList, isLoading: isFetchingCommands } =
    useCommandSearch(debouncedCommandSearch);
  const availableCommands: Command[] = commandList ?? [];

  const format = command?.format ?? "string";
  const content = command?.content ?? "";

  const validation = useMemo(() => validateInlineCommand({ format, content }), [format, content]);

  // Known-command autocomplete + hover hints only apply to the free-text `string`
  // format; json/yaml payloads are structured, not a single command word.
  const commandExtensions = useMemo(
    () =>
      format === "string"
        ? buildCommandExtensions({
            singleLine: true,
            placeholder: t("experiments.commandPanelPlaceholder"),
            readOnly: disabled,
          })
        : undefined,
    [format, disabled, t],
  );

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

  const handleSelectLibraryCommand = (id: string) => {
    if (disabled) return;
    onChange({ commandId: id, command: undefined });
    setCommandSearch("");
  };

  const modeButton = (value: CommandMode, label: string) => (
    <button
      type="button"
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        mode === value
          ? "bg-white text-[#011111] shadow-sm"
          : "text-muted-foreground hover:text-[#011111]",
      )}
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
    >
      {label}
    </button>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-jii-dark-green">{t("experiments.commandPanelTitle")}</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-[#EDF2F6] p-0.5">
            {modeButton("library", t("experiments.commandPanelLibrary"))}
            {modeButton("inline", t("experiments.commandPanelInline"))}
          </div>
          {mode === "inline" &&
            (!disabled ? (
              <Select
                value={format}
                onValueChange={(v) =>
                  onChange({ command: { format: v as CommandFormat, content } })
                }
              >
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
            ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {mode === "library" ? (
          <CommandSearchWithDropdown
            availableCommands={availableCommands}
            value={commandId ?? ""}
            placeholder={t("experiments.searchCommands")}
            loading={!isDebounced || isFetchingCommands}
            searchValue={commandSearch}
            onSearchChange={setCommandSearch}
            onAddCommand={handleSelectLibraryCommand}
            isAddingCommand={false}
            disabled={disabled}
          />
        ) : (
          <>
            <WorkbookCodeEditor
              value={content}
              onChange={disabled ? undefined : (v) => onChange({ command: { format, content: v } })}
              language={FORMAT_LANGUAGE[format]}
              minHeight={format === "string" ? "44px" : "120px"}
              maxHeight="400px"
              readOnly={disabled}
              extraExtensions={commandExtensions}
              basicSetup={commandBasicSetup}
            />
            {!validation.ok ? <p className="text-xs text-red-500">{validation.error}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
