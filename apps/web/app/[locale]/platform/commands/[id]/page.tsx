"use client";

import { CommandDetailsSidebar } from "@/components/command-overview/command-details-sidebar";
import { ErrorDisplay } from "@/components/error-display";
import { CommandCodePanel } from "@/components/shared/command-code-panel";
import type { CommandCode } from "@/components/shared/command-code-panel";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useCommand } from "@/hooks/command/useCommand/useCommand";
import { useCommandUpdate } from "@/hooks/command/useCommandUpdate/useCommandUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { use, useCallback, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface CommandOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function CommandOverviewPage({ params }: CommandOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useCommand(id);
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { mutateAsync: updateCommand, isPending: isUpdating } = useCommandUpdate(id);

  // `isValid` skips saves while the editor is mid-keystroke with raw text.
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState<CommandCode>();

  const save = useCallback(
    async (code: CommandCode) => {
      try {
        await updateCommand({
          params: { id },
          body: { code: code as Record<string, unknown>[] },
        });
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [id, updateCommand],
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

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("errors.failedToLoadCommand")} />;
  }

  if (!data) {
    return <div>{t("commands.notFound")}</div>;
  }

  const command = data.body;
  const isCreator = session?.user.id === command.createdBy;

  const handleDescriptionSave = async (newDescription: string) => {
    await updateCommand(
      { params: { id }, body: { description: newDescription } },
      {
        onSuccess: () => {
          toast({ description: t("commands.commandUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <CommandDetailsSidebar commandId={id} command={command} />

      <div className="flex-1 space-y-10 md:order-1">
        <InlineEditableDescription
          description={command.description ?? ""}
          hasAccess={isCreator}
          onSave={handleDescriptionSave}
          isPending={isUpdating}
          title={t("commands.descriptionTitle")}
          saveLabel={t("common.save")}
          cancelLabel={t("common.cancel")}
          placeholder={t("commands.descriptionPlaceholder")}
        />

        <CommandCodePanel
          code={command.code}
          isCreator={isCreator}
          isEditing={isEditing}
          editedCode={editedCode}
          handleChange={setEditedCode}
          status={autosave.status}
          closeEditing={closeEditing}
          startEditing={() => startEditing(command.code)}
          title={t("commands.codeTitle")}
          placeholder={t("commands.codePlaceholder")}
        />
      </div>
    </div>
  );
}
