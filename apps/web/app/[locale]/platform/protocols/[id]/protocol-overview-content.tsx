"use client";

import { ErrorDisplay } from "@/components/error-display";
import { ProtocolDetailsSidebar } from "@/components/protocol-overview/protocol-details-sidebar";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { ProtocolCodePanel } from "@/components/shared/protocol-code-panel";
import type { ProtocolCode } from "@/components/shared/protocol-code-panel";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { use, useCallback, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface ProtocolOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolOverviewPage({ params }: ProtocolOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useProtocol(id);
  const { t } = useTranslation();
  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(id);

  // `isValid` skips saves while the editor is mid-keystroke with raw text.
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState<ProtocolCode>();

  const save = useCallback(
    async (code: ProtocolCode) => {
      try {
        await updateProtocol({
          id,
          code,
        });
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [id, updateProtocol],
  );

  const autosave = useAutosave<ProtocolCode>({
    value: editedCode,
    toKey: (code) => JSON.stringify(code),
    isValid: (value) => Array.isArray(value),
    save,
    enabled: isEditing,
  });

  const startEditing = (initial: ProtocolCode) => {
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
    return <ErrorDisplay error={error} title={t("errors.failedToLoadProtocol")} />;
  }

  if (!data) {
    return <div>{t("protocols.notFound")}</div>;
  }

  const protocol = data;
  // Capability, not ownership: a "Can edit" grantee edits here too.
  const { canUpdate } = protocol.capabilities;

  const handleDescriptionSave = async (newDescription: string) => {
    await updateProtocol(
      { id, description: newDescription },
      {
        onSuccess: () => {
          toast({ description: t("protocols.protocolUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <ProtocolDetailsSidebar protocolId={id} protocol={protocol} />

      <div className="min-w-0 flex-1 space-y-10 md:order-1">
        <InlineEditableDescription
          description={protocol.description ?? ""}
          hasAccess={canUpdate}
          onSave={handleDescriptionSave}
          isPending={isUpdating}
          title={t("protocols.descriptionTitle")}
          saveLabel={t("common.save")}
          cancelLabel={t("common.cancel")}
          placeholder={t("protocols.descriptionPlaceholder")}
        />

        <ProtocolCodePanel
          code={protocol.code}
          canEdit={canUpdate}
          isEditing={isEditing}
          editedCode={editedCode}
          handleChange={setEditedCode}
          status={autosave.status}
          closeEditing={closeEditing}
          startEditing={() => startEditing(protocol.code)}
          title={t("protocols.codeTitle")}
          placeholder={t("protocols.codePlaceholder")}
        />
      </div>
    </div>
  );
}
