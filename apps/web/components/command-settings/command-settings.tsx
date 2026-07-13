"use client";

import { useTranslation } from "@repo/i18n";

import { useCommand } from "../../hooks/command/useCommand/useCommand";
import { CommandCompatibleMacrosCard } from "./command-compatible-macros-card";
import { CommandDetailsCard } from "./command-details-card";
import { CommandInfoCard } from "./command-info-card";

interface CommandSettingsProps {
  commandId: string;
}

export function CommandSettings({ commandId }: CommandSettingsProps) {
  const { data, isLoading } = useCommand(commandId);
  const { t } = useTranslation();

  if (isLoading) {
    return <div>{t("commandSettings.loading")}</div>;
  }

  if (!data) {
    return <div>{t("commandSettings.notFound")}</div>;
  }

  const command = data.body;

  return (
    <div className="flex flex-col gap-6">
      {/* Edit Command Details - Split Panel */}
      <CommandDetailsCard
        commandId={commandId}
        initialName={command.name}
        initialDescription={command.description ?? ""}
        initialCode={command.code}
        initialFamily={command.family}
      />

      {/* Compatible Macros Card */}
      <CommandCompatibleMacrosCard commandId={commandId} />

      {/* Command Info Card */}
      <CommandInfoCard commandId={commandId} command={command} />
    </div>
  );
}
