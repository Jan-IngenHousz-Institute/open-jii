"use client";

import { ErrorDisplay } from "@/components/error-display";
import { JsonCodeViewer } from "@/components/json-code-viewer";
import ProtocolCodeEditor from "@/components/protocol-code-editor";
import { ProtocolDetailsSidebar } from "@/components/protocol-overview/protocol-details-sidebar";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { Check, Circle, Loader2, X } from "lucide-react";
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

interface ProtocolOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolOverviewPage({ params }: ProtocolOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useProtocol(id);
  const { t } = useTranslation();
  const { data: session } = useSession();
  const {
    mutateAsync: updateProtocol,
    mutate: saveProtocol,
    isPending: isUpdating,
  } = useProtocolUpdate(id);

  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState<Record<string, unknown>[] | string | undefined>([]);
  const [syncStatus, setSyncStatus] = useState<"synced" | "unsynced" | "syncing">("synced");
  const savedCodeRef = useRef<string>("");
  const saveFnRef = useRef(saveProtocol);
  saveFnRef.current = saveProtocol;
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
    savedCodeRef.current = JSON.stringify(protocol.code);
    setSyncStatus("synced");
    setIsEditingCode(true);
  };

  const handleCodeEditClose = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (Array.isArray(editedCode)) {
      const key = JSON.stringify(editedCode);
      if (key !== savedCodeRef.current) {
        saveFnRef.current({ params: { id }, body: { code: editedCode } });
      }
    }
    setIsEditingCode(false);
  };

  const handleCodeChange = (value: Record<string, unknown>[] | string | undefined) => {
    setEditedCode(value);
    if (!Array.isArray(value)) return;

    const key = JSON.stringify(value);
    if (key === savedCodeRef.current) {
      setSyncStatus("synced");
      return;
    }

    setSyncStatus("unsynced");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSyncStatus("syncing");
      saveFnRef.current(
        { params: { id }, body: { code: value } },
        {
          onSuccess: () => {
            savedCodeRef.current = key;
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
            onChange={handleCodeChange}
            label=""
            placeholder={t("protocols.codePlaceholder")}
            title={t("protocols.codeTitle")}
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
