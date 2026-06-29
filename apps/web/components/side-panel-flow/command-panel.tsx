"use client";

import type { DeviceCommandOption } from "@repo/api/schemas/device-command.schema";
import { KNOWN_DEVICE_COMMANDS } from "@repo/api/schemas/device-command.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";

import { CommandEditor } from "../shared/command-editor";

interface CommandPanelProps {
  selectedCommand?: string;
  onChange: (command: string) => void;
  disabled?: boolean;
}

const COMMANDS: readonly DeviceCommandOption[] = KNOWN_DEVICE_COMMANDS;

export function CommandPanel({
  selectedCommand = "",
  onChange,
  disabled = false,
}: CommandPanelProps) {
  const { t } = useTranslation("experiments");
  const known = COMMANDS.find((c) => c.value === selectedCommand);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">{t("flow.commandPanel.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <CommandEditor
          value={selectedCommand}
          onChange={onChange}
          readOnly={disabled}
          aria-label={t("flow.commandPanel.title")}
          placeholder={t("flow.commandPanel.placeholder")}
          className="focus-within:border-jii-dark-green w-full rounded-md border border-gray-300 bg-white"
        />
        {known?.description ? <p className="text-xs text-gray-500">{known.description}</p> : null}
      </CardContent>
    </Card>
  );
}
