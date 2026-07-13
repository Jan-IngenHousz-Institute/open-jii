import { useLocale } from "@/hooks/useLocale";
import { Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface CommandWithInfo {
  id: string;
  name: string | null;
  family: string | null;
  createdBy?: string | null;
}

interface CommandListProps {
  commands: CommandWithInfo[];
  onRemoveCommand: (commandId: string) => void;
  isRemovingCommand: boolean;
  removingCommandId: string | null;
}

export function CommandList({
  commands,
  onRemoveCommand,
  isRemovingCommand,
  removingCommandId,
}: CommandListProps) {
  const { t } = useTranslation("common");
  const locale = useLocale();
  if (commands.length === 0) {
    return (
      <div className="border-muted flex flex-col items-center justify-center py-4">
        <p className="text-muted-foreground text-base font-medium">
          {t("experimentSettings.noCommandsYet")}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{t("experimentSettings.addCommands")}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
      {commands.map((command) => (
        <div
          key={command.id}
          className="flex items-center justify-between gap-3 rounded border px-3 py-2"
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {/* Command name */}
            <div className="mb-1 flex items-center">
              <h4 className="text-foreground flex-1 truncate text-sm font-medium">
                {command.name ?? t("experimentSettings.unknownCommand")}
              </h4>
            </div>

            {/* Family */}
            {command.family && (
              <div className="text-muted-foreground truncate text-xs">
                <span className="opacity-75">{t("experiments.family")}</span>{" "}
                <span className="font-medium">{command.family}</span>
              </div>
            )}

            {/* Created by */}
            {command.createdBy && (
              <div className="text-muted-foreground truncate text-xs">
                <span className="opacity-75">{t("experiments.createdBy")}</span>{" "}
                <span className="font-medium">{command.createdBy}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-0">
            {/* Delete button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveCommand(command.id)}
              disabled={isRemovingCommand && removingCommandId === command.id}
              title={t("experimentSettings.removeCommand")}
              className="hover:bg-destructive/10 h-8 w-8 shrink-0 p-0"
              aria-label={t("experimentSettings.removeCommand")}
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
            {/* External link button */}
            <Link
              href={`/${locale}/platform/commands/${command.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t("experimentSettings.seeCommandDetails")}
              aria-label={t("experimentSettings.seeCommandDetails")}
              className="hover:bg-muted m-0.5 rounded-md p-2"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
