"use client";

import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { decodeBase64, encodeBase64 } from "@/util/base64";
import { ArrowUpCircle, Check, Code, Copy, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { MacroLanguage } from "@repo/api/schemas/macro.schema";
import type { MacroCell as MacroCellType } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { CellWrapper } from "../cell-wrapper";
import { EntityVersionHistory } from "../entity-version-history";
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
  const version = cell.payload.version;
  const language = cell.payload.language;
  const { copy, copied } = useCopyToClipboard();
  const { data: session } = useSession();

  // One call returns the PINNED version's code/language plus the head metadata
  // (name, owner, latestVersion) so the cell renders its pin without a second request.
  const { data: macroData, isLoading } = useMacro(macroId, version);

  const macroName = macroData?.name;
  const latestVersion = macroData?.latestVersion;
  const rawCode = macroData?.code ?? null;
  const macroCode = rawCode ? decodeBase64(rawCode) : null;
  const macroLanguage = macroData?.language ?? language;
  const isOwner = !!session?.user.id && session.user.id === macroData?.createdBy;
  const isEditable = isOwner && !readOnly;
  const hasUpgrade = isEditable && latestVersion != null && latestVersion > version;

  const { mutate: saveMacro } = useMacroUpdate(macroId);

  const [localCode, setLocalCode] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedKeyRef = useRef<string>("");

  useEffect(() => {
    if (macroCode != null && localCode == null) {
      setLocalCode(macroCode);
      savedKeyRef.current = macroCode;
    }
  }, [macroCode, localCode]);

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
            onSuccess: (data) => {
              savedKeyRef.current = code;
              // Editing mints a new version server-side; re-pin THIS cell to it so other
              // workbooks stay on their version. localCode already holds this code, so the
              // editor does not flicker.
              onUpdate({ ...cell, payload: { ...cell.payload, version: data.body.latestVersion } });
            },
          },
        );
      }, 1000);
    },
    [macroId, saveMacro, cell, onUpdate],
  );

  const handleCopy = () => {
    const text = localCode ?? macroCode ?? "";
    void copy(text);
  };

  const handleLanguageChange = useCallback(
    (lang: MacroLanguage) => {
      saveMacro(
        { params: { id: macroId }, body: { language: lang } },
        {
          onSuccess: (data) => {
            onUpdate({
              ...cell,
              payload: { ...cell.payload, language: lang, version: data.body.latestVersion },
            });
          },
        },
      );
    },
    [macroId, saveMacro, cell, onUpdate],
  );

  const handleUpgrade = useCallback(() => {
    if (latestVersion == null) return;
    // Adopt the latest version: clear the local buffer so the editor reloads the new code.
    setLocalCode(null);
    savedKeyRef.current = "";
    onUpdate({ ...cell, payload: { ...cell.payload, version: latestVersion } });
  }, [cell, onUpdate, latestVersion]);

  const handleRestore = useCallback(() => {
    // After a restore the macro head advanced; adopt the new latest on next load.
    setLocalCode(null);
    savedKeyRef.current = "";
  }, []);

  const handleDuplicated = useCallback(
    (entity: { id: string; name: string }) => {
      // Swap this cell to the fork so the author edits their own copy.
      setLocalCode(null);
      savedKeyRef.current = "";
      onUpdate({
        ...cell,
        payload: { ...cell.payload, macroId: entity.id, version: 1, name: entity.name },
      });
    },
    [cell, onUpdate],
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
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            v{version}
          </Badge>
          {hasUpgrade ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[10px] font-medium text-[#005E5E] hover:text-[#005E5E]"
              onClick={handleUpgrade}
              title={`A newer version is available — update this cell to v${latestVersion}`}
            >
              <ArrowUpCircle className="h-3 w-3" />v{latestVersion}
            </Button>
          ) : null}
        </div>
      }
      headerActions={
        <div className="flex items-center gap-1">
          {isOwner && !readOnly ? (
            <EntityVersionHistory
              kind="macro"
              entityId={macroId}
              currentVersion={version}
              onRestored={handleRestore}
              onDuplicated={handleDuplicated}
            />
          ) : null}
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
              value={macroLanguage}
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
              {languageLabels[macroLanguage]}
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
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : localCode != null || macroCode != null ? (
        <WorkbookCodeEditor
          value={localCode ?? macroCode ?? ""}
          onChange={isEditable ? handleCodeChange : undefined}
          language={macroLanguage as EditorLanguage}
          minHeight={isEditable ? "120px" : "80px"}
          maxHeight={isEditable ? "500px" : "400px"}
          readOnly={readOnly ?? !isOwner}
          syntaxLinting={isEditable}
        />
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-xs">Could not load macro code</p>
      )}
    </CellWrapper>
  );
}
