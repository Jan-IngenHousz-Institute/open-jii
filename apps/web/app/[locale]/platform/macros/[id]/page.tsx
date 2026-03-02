"use client";

import { ErrorDisplay } from "@/components/error-display";
import MacroCodeEditor from "@/components/macro-code-editor";
import MacroCodeViewer from "@/components/macro-code-viewer";
import { MacroDetailsSidebar } from "@/components/macro-overview/macro-details-sidebar";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { decodeBase64, encodeBase64 } from "@/util/base64";
import { Check, CodeIcon, Pencil, X } from "lucide-react";
import { use, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface MacroOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function MacroOverviewPage({ params }: MacroOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useMacro(id);
  const { t } = useTranslation(["macro", "common"]);
  const { data: session } = useSession();
  const { mutateAsync: updateMacro, isPending: isUpdating } = useMacroUpdate(id);

  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState("");

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
      {
        params: { id },
        body: { description: newDescription },
      },
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

  const handleCodeEditStart = () => {
    setEditedCode(macro.code ? decodeBase64(macro.code) : "");
    setIsEditingCode(true);
  };

  const handleCodeEditCancel = () => {
    setIsEditingCode(false);
    setEditedCode("");
  };

  const handleCodeSave = async () => {
    await updateMacro(
      {
        params: { id },
        body: { code: encodeBase64(editedCode) },
      },
      {
        onSuccess: () => {
          toast({ description: t("macros.macroUpdated") });
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
      <MacroDetailsSidebar macroId={id} macro={macro} />

      {/* LEFT SIDE — Main Content (Second on mobile) */}
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

        {/* Code Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CodeIcon className="h-5 w-5" />
                {t("macros.code")}
              </CardTitle>
              {isCreator && !isEditingCode && macro.code && (
                <Button variant="outline" size="sm" onClick={handleCodeEditStart}>
                  <Pencil className="mr-1 h-4 w-4" />
                  {t("common.edit")}
                </Button>
              )}
              {isEditingCode && (
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
                  <Button size="sm" onClick={handleCodeSave} disabled={isUpdating}>
                    <Check className="mr-1 h-4 w-4" />
                    {t("common.save")}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingCode ? (
              <MacroCodeEditor
                value={editedCode}
                onChange={setEditedCode}
                language={macro.language}
                macroName={macro.name}
                label=""
              />
            ) : macro.code ? (
              <MacroCodeViewer
                value={decodeBase64(macro.code)}
                language={macro.language}
                height="500px"
                macroName={macro.name}
              />
            ) : (
              <div className="py-8 text-center text-gray-500">
                <CodeIcon className="mx-auto mb-4 h-12 w-12" />
                <p>{t("macros.codeNotAvailable")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
