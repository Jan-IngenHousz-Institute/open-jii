"use client";

import { ErrorDisplay } from "@/components/error-display";
import { JsonCodeViewer } from "@/components/json-code-viewer";
import ProtocolCodeEditor from "@/components/protocol-code-editor";
import { ProtocolDetailsSidebar } from "@/components/protocol-overview/protocol-details-sidebar";
import { CodeEditorHeaderActions } from "@/components/shared/code-editor-header-actions";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useCodeAutoSave } from "@/hooks/useCodeAutoSave";
import { useLocale } from "@/hooks/useLocale";
import { Play } from "lucide-react";
import Link from "next/link";
import { use, useCallback } from "react";
import { parseApiError } from "~/util/apiError";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

type ProtocolCode = Record<string, unknown>[] | string | undefined;

interface ProtocolOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolOverviewPage({ params }: ProtocolOverviewPageProps) {
  const { id } = use(params);
  const locale = useLocale();
  const { data, isLoading, error } = useProtocol(id);
  const { t } = useTranslation();
  const { data: session } = useSession();
  const {
    mutateAsync: updateProtocol,
    mutate: saveProtocol,
    isPending: isUpdating,
  } = useProtocolUpdate(id);

  const buildPayload = useCallback(
    (code: ProtocolCode) => ({ params: { id }, body: { code: code as Record<string, unknown>[] } }),
    [id],
  );

  const { isEditing, editedCode, syncStatus, startEditing, closeEditing, handleChange } =
    useCodeAutoSave<ProtocolCode, ReturnType<typeof buildPayload>>({
      saveFn: saveProtocol,
      buildPayload,
      toKey: (code) => JSON.stringify(code),
      isValid: (value) => Array.isArray(value),
    });

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("errors.failedToLoadProtocol")} />;
  }

  if (!data) {
    return <div>{t("protocols.notFound")}</div>;
  }

  const protocol = data.body;
  const isCreator = session?.user.id === protocol.createdBy;

  const handleDescriptionSave = async (newDescription: string) => {
    await updateProtocol(
      { params: { id }, body: { description: newDescription } },
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

      <div className="flex-1 space-y-10 md:order-1">
        <div className="-mt-10 flex justify-end">
          <Button size="sm" asChild>
            <Link href={`/${locale}/platform/protocols/${id}/run`}>
              <Play className="mr-2 h-4 w-4" />
              {t("protocolSettings.testerTitle")}
            </Link>
          </Button>
        </div>
        <InlineEditableDescription
          description={protocol.description ?? ""}
          hasAccess={isCreator}
          onSave={handleDescriptionSave}
          isPending={isUpdating}
          title={t("protocols.descriptionTitle")}
          saveLabel={t("common.save")}
          cancelLabel={t("common.cancel")}
          placeholder={t("protocols.descriptionPlaceholder")}
        />

        {isEditing ? (
          <ProtocolCodeEditor
            value={editedCode ?? []}
            onChange={handleChange}
            label=""
            placeholder={t("protocols.codePlaceholder")}
            title={t("protocols.codeTitle")}
            headerActions={
              <CodeEditorHeaderActions syncStatus={syncStatus} onClose={closeEditing} />
            }
          />
        ) : (
          <JsonCodeViewer
            value={protocol.code}
            height="700px"
            title={t("protocols.codeTitle")}
            onEditStart={isCreator ? () => startEditing(protocol.code) : undefined}
          />
        )}
      </div>
    </div>
  );
}
