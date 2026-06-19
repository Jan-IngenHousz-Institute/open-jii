"use client";

import { ErrorDisplay } from "@/components/error-display";
import MacroCodeEditor from "@/components/macro-code-editor";
import MacroCodeViewer from "@/components/macro-code-viewer";
import { MacroDetailsSidebar } from "@/components/macro-overview/macro-details-sidebar";
import { CodeEditorHeaderActions } from "@/components/shared/code-editor-header-actions";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { decodeBase64, encodeBase64 } from "@/util/base64";
import { CodeIcon } from "lucide-react";
import { use, useCallback, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface MacroOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function MacroOverviewPage({ params }: MacroOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useMacro(id);
  const { t } = useTranslation(["macro", "common"]);
  const { data: session } = useSession();
  const { mutateAsync: updateMacro, isPending: isUpdating } = useMacroUpdate(id);

  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState("");

  const save = useCallback(
    async (code: string) => {
      try {
        await updateMacro({ params: { id }, body: { code: encodeBase64(code) } });
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [id, updateMacro],
  );

  const autosave = useAutosave<string>({
    value: editedCode,
    toKey: (code) => code,
    save,
    enabled: isEditing,
  });

  const startEditing = (initial: string) => {
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
    return <ErrorDisplay error={error} title={t("errors.failedToLoadMacro")} />;
  }

  if (!data) {
    return <div>{t("macros.notFound")}</div>;
  }

  const macro = data;
  const isCreator = session?.user.id === macro.createdBy;

  const handleDescriptionSave = async (newDescription: string) => {
    await updateMacro(
      { params: { id }, body: { description: newDescription } },
      {
        onSuccess: () => {
          toast({ description: t("macros.macroUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <MacroDetailsSidebar macroId={id} macro={macro} />

      <div className="flex-1 space-y-10 md:order-1">
        <InlineEditableDescription
          description={macro.description ?? ""}
          hasAccess={isCreator}
          onSave={handleDescriptionSave}
          isPending={isUpdating}
          title={t("common.description")}
          saveLabel={t("common.save")}
          cancelLabel={t("common.cancel")}
          placeholder={t("macros.descriptionPlaceholder")}
        />

        {isEditing ? (
          <MacroCodeEditor
            value={editedCode}
            onChange={setEditedCode}
            language={macro.language}
            label=""
            title={t("macros.codeTitle")}
            headerActions={
              <CodeEditorHeaderActions status={autosave.status} onClose={closeEditing} />
            }
          />
        ) : macro.code ? (
          <MacroCodeViewer
            value={decodeBase64(macro.code)}
            language={macro.language}
            height="500px"
            title={t("macros.codeTitle")}
            onEditStart={isCreator ? () => startEditing(decodeBase64(macro.code)) : undefined}
          />
        ) : (
          <div className="py-8 text-center text-gray-500">
            <CodeIcon className="mx-auto mb-4 h-12 w-12" />
            <p>{t("macros.codeNotAvailable")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
