"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { decodeBase64, encodeBase64 } from "@/util/base64";
import { Check, Code, Copy, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { MacroLanguage } from "@repo/api/schemas/macro.schema";
import type { MacroCell as MacroCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";

interface MacroCellProps {
  cell: MacroCellType;
  onUpdate: (cell: MacroCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
  // Immutable code pinned at publish time. When present the cell renders
  // exclusively from it and never fetches the live macro row.
  snapshot?: { code: string };
}

const languageLabels: Record<MacroLanguage, string> = {
  python: "Python",
  r: "R",
  javascript: "JavaScript",
};

export function MacroCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
  snapshot,
}: MacroCellProps) {
  const macroId = cell.payload.macroId;
  const language = cell.payload.language;
  const { copy, copied } = useCopyToClipboard();
  const { data: session } = useSession();
  const { t } = useTranslation("workbook");

  const useSnapshot = snapshot != null;
  const { data: macroData, isLoading: liveLoading } = useMacro(macroId, !useSnapshot);
  const macroLoading = !useSnapshot && liveLoading;
  const macroName = macroData?.name;
  const rawCode = useSnapshot ? snapshot.code : (macroData?.code ?? null);
  const macroCode = rawCode ? decodeBase64(rawCode) : null;
  const macroLanguage = macroData?.language;
  const isOwner = !!session?.user.id && session.user.id === macroData?.createdBy;
  const isEditable = isOwner && !readOnly;
  // Read-only purely because the viewer did not create this macro (not because
  // the cell is rendered from a pinned snapshot or in a read-only host).
  const isReadOnlyForNonOwner = !useSnapshot && !readOnly && !!macroData && !isOwner;

  const { mutateAsync: saveMacro } = useMacroUpdate(macroId);

  const [localCode, setLocalCode] = useState<string | null>(null);

  useEffect(() => {
    if (macroCode != null && localCode == null) {
      setLocalCode(macroCode);
    }
  }, [macroCode, localCode]);

  // Mirror the protocol cell: persist via the shared `useAutosave` hook so a
  // failed save surfaces a toast and the indicator flips to "error" instead of
  // silently dropping the edit.
  const save = useCallback(
    async (code: string) => {
      try {
        await saveMacro({ params: { id: macroId }, body: { code: encodeBase64(code) } });
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [macroId, saveMacro],
  );

  const autosave = useAutosave<string>({
    value: localCode ?? "",
    toKey: (code) => code,
    save,
    enabled: isEditable && localCode != null,
  });

  const handleCopy = () => {
    const text = localCode ?? macroCode ?? "";
    void copy(text);
  };

  const handleLanguageChange = useCallback(
    (lang: MacroLanguage) => {
      void saveMacro({ params: { id: macroId }, body: { language: lang } }).catch(
        (err: unknown) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      );
      onUpdate({ ...cell, payload: { ...cell.payload, language: lang } });
    },
    [macroId, saveMacro, cell, onUpdate],
  );

  const [langSelectOpen, setLangSelectOpen] = useState(false);

  const displayName = cell.payload.name ?? macroName ?? "Macro";

  return (
    <CellWrapper
      icon={<Code className="h-3.5 w-3.5" />}
      label={displayName}
      accentColor="#6C5CE7"
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      forceActionsVisible={langSelectOpen}
      onRun={onRun}
      headerBadges={
        isEditable && localCode != null ? (
          <AutosaveIndicator status={autosave.status} variant="compact" />
        ) : undefined
      }
      headerActions={
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 p-0 hover:text-[#005E5E]"
            title="Open macro in new tab"
          >
            <Link
              href={`/platform/macros/${macroId}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open macro in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
          {isOwner && (
            <Select
              value={macroLanguage ?? language}
              onValueChange={(v) => handleLanguageChange(v as MacroLanguage)}
              open={langSelectOpen}
              onOpenChange={setLangSelectOpen}
            >
              <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(languageLabels) as [MacroLanguage, string][]).map(
                  ([val, label]) => (
                    <SelectItem key={val} value={val} className="text-xs">
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          )}
          {!isOwner && (
            <span className="text-muted-foreground px-2 text-xs">
              {languageLabels[macroLanguage ?? language]}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 p-0"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      }
    >
      {macroLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : localCode != null || macroCode != null ? (
        <>
          {isReadOnlyForNonOwner && (
            <p className="text-muted-foreground px-3 pt-2 text-xs">{t("cells.macroReadOnly")}</p>
          )}
          <WorkbookCodeEditor
            value={localCode ?? macroCode ?? ""}
            onChange={isEditable ? setLocalCode : undefined}
            language={macroLanguage ?? language}
            minHeight={isEditable ? "120px" : "80px"}
            maxHeight={isEditable ? "500px" : "400px"}
            readOnly={!isEditable}
            syntaxLinting={isEditable}
          />
        </>
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-xs">Could not load macro code</p>
      )}
    </CellWrapper>
  );
}
