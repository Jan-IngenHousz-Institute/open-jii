"use client";

import { IotCommandRunner } from "@/components/iot/iot-command-runner";
import { CodeTesterLayout } from "@/components/shared/code-tester-layout";
import { CommandCodePanel } from "@/components/shared/command-code-panel";
import type { CommandCode } from "@/components/shared/command-code-panel";
import { useCommand } from "@/hooks/command/useCommand/useCommand";
import { useCommandUpdate } from "@/hooks/command/useCommandUpdate/useCommandUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCallback, useState } from "react";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";
import { parseApiError } from "~/util/apiError";

import type { SensorFamily } from "@repo/api/schemas/command.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface CommandRunContentProps {
  commandId: string;
}

export function CommandRunContent({ commandId }: CommandRunContentProps) {
  const { data: commandData, isLoading } = useCommand(commandId);
  const { data: session } = useSession();
  const { t } = useTranslation();

  const family = (commandData?.body as { family?: SensorFamily } | undefined)?.family;
  const browserSupport = useIotBrowserSupport(family);

  const { mutateAsync: updateCommand } = useCommandUpdate(commandId);

  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState<CommandCode>();

  const save = useCallback(
    async (code: CommandCode) => {
      try {
        await updateCommand({
          params: { id: commandId },
          body: { code: code as Record<string, unknown>[] },
        });
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [commandId, updateCommand],
  );

  const autosave = useAutosave<CommandCode>({
    value: editedCode,
    toKey: (code) => JSON.stringify(code),
    isValid: (value) => Array.isArray(value),
    save,
    enabled: isEditing,
  });

  const startEditing = (initial: CommandCode) => {
    setEditedCode(initial);
    setIsEditing(true);
  };
  const closeEditing = async () => {
    await autosave.flush();
    setIsEditing(false);
  };

  const command = commandData?.body;
  const isCreator = session?.user.id === command?.createdBy;

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (!command) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h4 className="text-lg font-medium">{t("commands.notFound")}</h4>
          <p className="text-muted-foreground text-sm">{t("commands.notFoundDescription")}</p>
        </div>
      </div>
    );
  }

  const rawCode = isEditing ? editedCode : command.code;
  const commandCode = Array.isArray(rawCode) ? rawCode : command.code;

  const codePanel = (
    <CommandCodePanel
      code={command.code}
      isCreator={isCreator}
      isEditing={isEditing}
      editedCode={editedCode}
      handleChange={setEditedCode}
      status={autosave.status}
      closeEditing={closeEditing}
      startEditing={() => startEditing(command.code)}
      placeholder={t("newCommand.codePlaceholder")}
      height="100%"
      borderless
    />
  );

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[500px] flex-col">
      <CodeTesterLayout
        codePanel={codePanel}
        testerPanel={
          <IotCommandRunner
            commandCode={commandCode}
            sensorFamily={command.family}
            layout="vertical"
          />
        }
        testerTitle={t("commandSettings.testerTitle")}
        browserSupport={browserSupport}
      />
    </div>
  );
}
