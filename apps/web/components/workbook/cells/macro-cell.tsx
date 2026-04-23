"use client";

import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { decodeBase64, encodeBase64 } from "@/util/base64";
import { Check, Code, Copy, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { MacroCell as MacroCellType } from "@repo/api";
import type { MacroLanguage } from "@repo/api";
import { useSession } from "@repo/auth/client";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

import { CellWrapper } from "../cell-wrapper";
import type { EditorLanguage } from "../workbook-code-editor";
import { WorkbookCodeEditor } from "../workbook-code-editor";

interface MacroCellProps {
  cell: MacroCellType;
  onUpdate: (cell: MacroCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
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
}: MacroCellProps) {
  const macroId = cell.payload.macroId;
  const language = cell.payload.language;
  const { copy, copied } = useCopyToClipboard();
  const { data: session } = useSession();

  // Fetch macro data
  const { data: macroData, isLoading: macroLoading } = useMacro(macroId);
  const macroName = macroData?.name;
  const rawCode = macroData?.code ?? null;
  const macroCode = rawCode ? decodeBase64(rawCode) : null;
  const macroLanguage = macroData?.language;
  const isOwner = !!session?.user.id && session.user.id === macroData?.createdBy;

  // Mutations
  const { mutate: saveMacro } = useMacroUpdate(macroId);

  // --- Auto-save for owned macros ---
  const [localCode, setLocalCode] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedKeyRef = useRef<string>("");

  // Sync local code when macro data loads or changes externally
  useEffect(() => {
    if (macroCode != null && localCode == null) {
      setLocalCode(macroCode);
      savedKeyRef.current = macroCode;
    }
  }, [macroCode, localCode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleCodeChange = useCallback(
    (code: string) => {
      setLocalCode(code);

      if (code === savedKeyRef.current) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveMacro(
          { params: { id: macroId }, body: { code: encodeBase64(code) } },
          {
            onSuccess: () => {
              savedKeyRef.current = code;
            },
          },
        );
      }, 1000);
    },
    [macroId, saveMacro],
  );

  const handleCopy = () => {
    const text = localCode ?? macroCode ?? "";
    void copy(text);
  };

  const handleLanguageChange = useCallback(
    (lang: MacroLanguage) => {
      saveMacro({ params: { id: macroId }, body: { language: lang } });
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
      headerBadges={
        <div className="flex items-center gap-1">
          <Link href={`/platform/macros/${macroId}`} target="_blank">
            <ExternalLink className="text-muted-foreground hover:text-foreground h-3 w-3 transition-colors" />
          </Link>
        </div>
      }
      onRun={onRun}
      headerActions={
        <div className="flex items-center gap-1">
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
        <WorkbookCodeEditor
          value={localCode ?? macroCode ?? ""}
          onChange={isOwner && !readOnly ? handleCodeChange : undefined}
          language={(macroLanguage ?? language) as EditorLanguage}
          minHeight={isOwner && !readOnly ? "120px" : "80px"}
          maxHeight={isOwner && !readOnly ? "500px" : "400px"}
          readOnly={readOnly ?? !isOwner}
          syntaxLinting={isOwner && !readOnly}
        />
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-xs">Could not load macro code</p>
      )}
    </CellWrapper>
  );
}
