"use client";

import { ErrorDisplay } from "@/components/error-display";
import MacroCodeEditor from "@/components/macro-code-editor";
import MacroCodeViewer from "@/components/macro-code-viewer";
import { MacroDetailsSidebar } from "@/components/macro-overview/macro-details-sidebar";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { decodeBase64, encodeBase64 } from "@/util/base64";
import { Check, Circle, CodeIcon, Loader2, X } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface MacroOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function MacroOverviewPage({ params }: MacroOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useMacro(id);
  const { t } = useTranslation(["macro", "common"]);
  const { data: session } = useSession();
  const { mutateAsync: updateMacro, mutate: saveMacro, isPending: isUpdating } = useMacroUpdate(id);

  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState("");
  const [syncStatus, setSyncStatus] = useState<"synced" | "unsynced" | "syncing">("synced");
  const savedCodeRef = useRef("");
  const saveFnRef = useRef(saveMacro);
  saveFnRef.current = saveMacro;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    const ref = saveTimeoutRef;
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, []);

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
    const code = macro.code ? decodeBase64(macro.code) : "";
    setEditedCode(code);
    savedCodeRef.current = code;
    setSyncStatus("synced");
    setIsEditingCode(true);
  };

  const handleCodeEditClose = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (editedCode !== savedCodeRef.current) {
      saveFnRef.current({ params: { id }, body: { code: encodeBase64(editedCode) } });
    }
    setIsEditingCode(false);
  };

  const handleCodeChange = (newCode: string) => {
    setEditedCode(newCode);

    if (newCode === savedCodeRef.current) {
      setSyncStatus("synced");
      return;
    }

    setSyncStatus("unsynced");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSyncStatus("syncing");
      saveFnRef.current(
        { params: { id }, body: { code: encodeBase64(newCode) } },
        {
          onSuccess: () => {
            savedCodeRef.current = newCode;
            setSyncStatus("synced");
          },
          onError: (err) => {
            toast({ description: parseApiError(err)?.message, variant: "destructive" });
            setSyncStatus("unsynced");
          },
        },
      );
    }, 1000);
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
        {isEditingCode ? (
          <MacroCodeEditor
            value={editedCode}
            onChange={handleCodeChange}
            language={macro.language}
            label=""
            title={t("macros.codeTitle")}
            headerActions={
              <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center">
                        {syncStatus === "unsynced" && (
                          <Circle className="h-4 w-4 fill-amber-500 text-amber-500" />
                        )}
                        {syncStatus === "syncing" && (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        )}
                        {syncStatus === "synced" && <Check className="h-4 w-4 text-green-600" />}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {syncStatus === "unsynced" && "Unsaved changes"}
                      {syncStatus === "syncing" && "Saving..."}
                      {syncStatus === "synced" && "All changes saved"}
                    </TooltipContent>
                  </Tooltip>
                  <span className="h-4 w-px bg-slate-300" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCodeEditClose}
                        className="h-7 w-7 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Close editor</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            }
          />
        ) : macro.code ? (
          <MacroCodeViewer
            value={decodeBase64(macro.code)}
            language={macro.language}
            height="500px"
            title={t("macros.codeTitle")}
            onEditStart={isCreator ? handleCodeEditStart : undefined}
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
