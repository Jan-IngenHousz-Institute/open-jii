"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useMemo } from "react";

import type { CommandFormat } from "@repo/api/domains/experiment/experiment.schema";
import { validateInlineCommand } from "@repo/api/transforms/command-payload";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

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

interface CommandPanelProps {
  command?: InlineCommandValue;
  onChange: (command: InlineCommandValue) => void;
  disabled?: boolean;
}

export function CommandPanel({ command, onChange, disabled = false }: CommandPanelProps) {
  const { t } = useTranslation("common");
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

  return (
    <SettingsCard
      title={t("experiments.commandPanelTitle")}
      action={
        !disabled ? (
          <Select
            value={format}
            onValueChange={(v) => onChange({ format: v as CommandFormat, content })}
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
          <span className="text-muted-foreground text-xs uppercase">{FORMAT_LABELS[format]}</span>
        )
      }
      className="mb-6"
      contentClassName="space-y-2"
    >
      <WorkbookCodeEditor
        value={content}
        onChange={disabled ? undefined : (v) => onChange({ format, content: v })}
        language={FORMAT_LANGUAGE[format]}
        minHeight={format === "string" ? "44px" : "120px"}
        maxHeight="400px"
        readOnly={disabled}
        extraExtensions={commandExtensions}
        basicSetup={commandBasicSetup}
      />
      {!validation.ok ? <p className="text-destructive text-xs">{validation.error}</p> : null}
    </SettingsCard>
  );
}
