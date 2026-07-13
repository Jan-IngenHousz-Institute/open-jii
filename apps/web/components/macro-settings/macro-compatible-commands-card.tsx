"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { ExternalLink, FileJson2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Command } from "@repo/api/schemas/command.schema";
import type { MacroCommandEntry } from "@repo/api/schemas/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";

import { useCommandSearch } from "../../hooks/command/useCommandSearch/useCommandSearch";
import { useAddCompatibleCommand } from "../../hooks/macro/useAddCompatibleCommand/useAddCompatibleCommand";
import { useMacroCompatibleCommands } from "../../hooks/macro/useMacroCompatibleCommands/useMacroCompatibleCommands";
import { useRemoveCompatibleCommand } from "../../hooks/macro/useRemoveCompatibleCommand/useRemoveCompatibleCommand";
import { CommandSearchWithDropdown } from "../command-search-with-dropdown";

const getFamilyColor = (family: string) => {
  switch (family) {
    case "multispeq":
      return "bg-badge-published";
    case "ambyte":
      return "bg-badge-active";
    default:
      return "bg-badge-archived";
  }
};

interface MacroCompatibleCommandsCardProps {
  macroId: string;
  embedded?: boolean;
}

export function MacroCompatibleCommandsCard({
  macroId,
  embedded,
}: MacroCompatibleCommandsCardProps) {
  const { t } = useTranslation("macro");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  const compatibleQuery = useMacroCompatibleCommands(macroId);
  const isLoading = compatibleQuery.isLoading;
  const compatibleCommands: MacroCommandEntry[] = useMemo(
    () => compatibleQuery.data?.body ?? [],
    [compatibleQuery.data],
  );

  const addMutation = useAddCompatibleCommand(macroId);
  const removeMutation = useRemoveCompatibleCommand(macroId);
  const isAdding = addMutation.isPending;
  const isRemoving = removeMutation.isPending;

  // Command search for the add dropdown
  const [commandSearch, setCommandSearch] = useState("");
  const [debouncedCommandSearch, isDebounced] = useDebounce(commandSearch, 300);
  const { commands: commandList } = useCommandSearch(debouncedCommandSearch || undefined);

  const compatibleCommandIds = useMemo(
    () => new Set(compatibleCommands.map((entry) => entry.command.id)),
    [compatibleCommands],
  );

  // Filter out already-linked commands from the search dropdown
  const availableCommands: Command[] = useMemo(
    () => (commandList ?? []).filter((p) => !compatibleCommandIds.has(p.id)),
    [commandList, compatibleCommandIds],
  );

  const handleAddCommand = async (commandId: string) => {
    await addMutation.mutateAsync({
      params: { id: macroId },
      body: { commandIds: [commandId] },
    });
    setCommandSearch("");
  };

  const handleRemoveCommand = async (commandId: string) => {
    await removeMutation.mutateAsync({
      params: { id: macroId, commandId },
    });
  };

  const content = (
    <>
      {/* Add command dropdown */}
      <CommandSearchWithDropdown
        availableCommands={availableCommands}
        value=""
        placeholder={t("macroSettings.addCompatibleCommand")}
        loading={!isDebounced}
        searchValue={commandSearch}
        onSearchChange={setCommandSearch}
        onAddCommand={handleAddCommand}
        isAddingCommand={isAdding}
      />

      {/* List of currently linked commands */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">{tCommon("common.loading")}</div>
      ) : compatibleCommands.length > 0 ? (
        <div className="space-y-3">
          {compatibleCommands.map((entry) => (
            <div
              key={entry.command.id}
              className="shadow-xs group rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <FileJson2 className="text-muted-foreground h-4 w-4 shrink-0" />
                    <Link
                      href={`/${locale}/platform/commands/${entry.command.id}`}
                      className="line-clamp-2 text-sm font-semibold hover:underline"
                    >
                      {entry.command.name}
                    </Link>
                    <Link
                      href={`/${locale}/platform/commands/${entry.command.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <Badge className={`${getFamilyColor(entry.command.family)} capitalize`}>
                    {entry.command.family}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => handleRemoveCommand(entry.command.id)}
                  disabled={isRemoving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t("macroSettings.noCompatibleCommands")}</p>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium">{t("macroSettings.compatibleCommands")}</h4>
          <p className="text-muted-foreground text-sm">
            {t("macroSettings.compatibleCommandsDescription")}
          </p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("macroSettings.compatibleCommands")}</CardTitle>
        <CardDescription>{t("macroSettings.compatibleCommandsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{content}</CardContent>
    </Card>
  );
}
