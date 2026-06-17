"use client";

import { useMemo } from "react";

import type { DeviceCommandOption } from "@repo/api/schemas/device-command.schema";
import { KNOWN_DEVICE_COMMANDS } from "@repo/api/schemas/device-command.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";

interface CommandPanelProps {
  selectedCommand?: string;
  onChange: (command: string) => void;
  disabled?: boolean;
}

const COMMANDS: readonly DeviceCommandOption[] = KNOWN_DEVICE_COMMANDS;

/** Group the known device commands by their `group`, preserving declaration order. */
function groupedCommands(): { group: string; options: DeviceCommandOption[] }[] {
  const groups: { group: string; options: DeviceCommandOption[] }[] = [];
  for (const option of COMMANDS) {
    let bucket = groups.find((g) => g.group === option.group);
    if (!bucket) {
      bucket = { group: option.group, options: [] };
      groups.push(bucket);
    }
    bucket.options.push(option);
  }
  return groups;
}

export function CommandPanel({
  selectedCommand = "",
  onChange,
  disabled = false,
}: CommandPanelProps) {
  const { t } = useTranslation("experiments");
  const groups = useMemo(groupedCommands, []);
  const selected = COMMANDS.find((c) => c.value === selectedCommand);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">{t("flow.commandPanel.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <select
          aria-label={t("flow.commandPanel.title")}
          value={selectedCommand}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="focus:border-jii-dark-green focus:ring-jii-dark-green w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          <option value="" disabled>
            {t("flow.commandPanel.placeholder")}
          </option>
          {groups.map(({ group, options }) => (
            <optgroup key={group} label={group}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selected?.description ? (
          <p className="text-xs text-gray-500">{selected.description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
