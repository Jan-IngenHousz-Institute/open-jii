"use client";

import { ErrorDisplay } from "@/components/error-display";
import { JsonCodeViewer } from "@/components/json-code-viewer";
import ProtocolCodeEditor from "@/components/protocol-code-editor";
import { ProtocolDetailsSidebar } from "@/components/protocol-overview/protocol-details-sidebar";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { Check, X } from "lucide-react";
import { use, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface ProtocolOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolOverviewPage({ params }: ProtocolOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useProtocol(id);
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(id);

  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState<Record<string, unknown>[] | string | undefined>([]);
  const [isCodeValid, setIsCodeValid] = useState(true);

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
      {
        params: { id },
        body: { description: newDescription },
      },
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

  const handleCodeEditStart = () => {
    setEditedCode(protocol.code);
    setIsEditingCode(true);
  };

  const handleCodeEditCancel = () => {
    setIsEditingCode(false);
    setEditedCode([]);
  };

  const handleCodeSave = async () => {
    if (!Array.isArray(editedCode)) return;
    await updateProtocol(
      {
        params: { id },
        body: { code: editedCode },
      },
      {
        onSuccess: () => {
          toast({ description: t("protocols.protocolUpdated") });
          setIsEditingCode(false);
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* RIGHT SIDE — Details Sidebar (First on mobile) */}
      <ProtocolDetailsSidebar protocolId={id} protocol={protocol} />

      {/* LEFT SIDE — Main Content (Second on mobile) */}
      <div className="flex-1 space-y-10 md:order-1">
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

        {/* Code Section */}
        {isEditingCode ? (
          <ProtocolCodeEditor
            value={editedCode ?? []}
            onChange={setEditedCode}
            onValidationChange={setIsCodeValid}
            label=""
            placeholder={t("protocols.codePlaceholder")}
            title={t("protocols.codeTitle")}
            headerActions={
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCodeEditCancel}
                  disabled={isUpdating}
                >
                  <X className="mr-1 h-4 w-4" />
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleCodeSave} disabled={isUpdating || !isCodeValid}>
                  <Check className="mr-1 h-4 w-4" />
                  {t("common.save")}
                </Button>
              </div>
            }
          />
        ) : (
          <JsonCodeViewer
            value={protocol.code}
            height="700px"
            title={t("protocols.codeTitle")}
            onEditStart={isCreator ? handleCodeEditStart : undefined}
          />
        )}
      </div>
    </div>
  );
}
