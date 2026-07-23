"use client";

import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useWorkbookVersion } from "@/hooks/workbook/useWorkbookVersion/useWorkbookVersion";
import { diffCells } from "@/lib/workbook-diff";
import { AlertTriangle, ArrowUpCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { WorkbookIssue } from "@repo/api/transforms/validate-workbook";
import { validateWorkbook } from "@repo/api/transforms/validate-workbook";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { cn } from "@repo/ui/lib/utils";

import { MacroDiffRow, ProtocolDiffRow } from "./entity-diff-row";
import type { ResolvedEntity } from "./entity-diff-row";

interface WorkbookUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workbookId: string;
  /** The version the experiment is currently pinned to. */
  pinnedVersionId: string;
  currentVersion: number;
  /** Human label for the version the upgrade will move to (e.g. "v4"). */
  targetVersionLabel: string;
  onConfirm: () => void;
  isUpgrading: boolean;
}

function issueMessage(
  t: (key: string, opts?: Record<string, unknown>) => string,
  issue: WorkbookIssue,
): string {
  const label = issue.cellLabel ?? issue.ref ?? "";
  switch (issue.code) {
    case "missing-protocol":
      return t("flow.upgradeDiff.issue.missingProtocol", { label });
    case "missing-macro":
      return t("flow.upgradeDiff.issue.missingMacro", { label });
    case "dangling-branch-source":
      return t("flow.upgradeDiff.issue.danglingSource", { ref: issue.ref ?? "" });
    case "dangling-branch-goto":
      return t("flow.upgradeDiff.issue.danglingGoto", { ref: issue.ref ?? "" });
    case "macro-without-input":
      return t("flow.upgradeDiff.issue.macroWithoutInput", { label });
    case "mixed-sensor-families":
      return t("flow.upgradeDiff.issue.mixedFamilies", { detail: issue.detail ?? "" });
  }
}

export function WorkbookUpgradeDialog({
  open,
  onOpenChange,
  workbookId,
  pinnedVersionId,
  currentVersion,
  targetVersionLabel,
  onConfirm,
  isUpgrading,
}: WorkbookUpgradeDialogProps) {
  const { t } = useTranslation("experiments");

  const {
    data: pinned,
    isLoading: pinnedLoading,
    error: pinnedError,
  } = useWorkbookVersion(workbookId, pinnedVersionId, { enabled: open });
  const {
    data: live,
    isLoading: liveLoading,
    error: liveError,
  } = useWorkbook(workbookId, { enabled: open });
  const loadError = pinnedError ?? liveError;

  const liveCells: WorkbookCell[] = useMemo(() => live?.cells ?? [], [live]);
  const cellChanges = useMemo(
    () => (pinned ? diffCells(pinned.cells, liveCells) : []),
    [pinned, liveCells],
  );

  // Unique protocol/macro ids referenced by the target (live) workbook.
  const referenced = useMemo(() => {
    const protocols = new Map<string, string | undefined>();
    const macros = new Map<string, string | undefined>();
    for (const cell of liveCells) {
      if (cell.type === "protocol") protocols.set(cell.payload.protocolId, cell.payload.name);
      if (cell.type === "macro") macros.set(cell.payload.macroId, cell.payload.name);
    }
    return { protocols, macros };
  }, [liveCells]);
  const totalRefs = referenced.protocols.size + referenced.macros.size;

  const [resolved, setResolved] = useState<Record<string, ResolvedEntity>>({});
  useEffect(() => {
    if (!open) setResolved({});
  }, [open]);
  const handleResolved = useCallback((r: ResolvedEntity) => {
    setResolved((prev) => (r.id in prev ? prev : { ...prev, [r.id]: r }));
  }, []);

  const verdict = useMemo(() => {
    if (!pinned || !live) return null;
    if (Object.keys(resolved).length < totalRefs) return null;
    const ctx = {
      protocols: {} as Record<string, { family?: ResolvedEntity["family"] }>,
      macros: {} as Record<string, unknown>,
    };
    for (const r of Object.values(resolved)) {
      if (!r.exists) continue;
      if (r.kind === "protocol") ctx.protocols[r.id] = { family: r.family };
      else ctx.macros[r.id] = {};
    }
    return validateWorkbook(liveCells, ctx);
  }, [pinned, live, resolved, totalRefs, liveCells]);

  // A referenced entity that failed to load (non-404) means we cannot trust the
  // verdict: validateWorkbook would see it as missing and emit a false blocking
  // error. Surface it as a load failure instead.
  const entityLoadFailed = Object.values(resolved).some((r) => r.loadFailed);
  const errors = verdict?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = verdict?.issues.filter((i) => i.level === "warning") ?? [];
  const ready = !!pinned && !!live;
  const failed = !!loadError || entityLoadFailed;
  const loading = !failed && !ready && (pinnedLoading || liveLoading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("flow.upgradeDiff.title")}</DialogTitle>
          <DialogDescription>
            {t("flow.upgradeDiff.subtitle", { from: currentVersion, to: targetVersionLabel })}
          </DialogDescription>
        </DialogHeader>

        {failed ? (
          <div className="text-destructive flex items-center gap-2 py-8 text-sm">
            <XCircle className="h-4 w-4 shrink-0" />
            {t("flow.upgradeDiff.loadError")}
          </div>
        ) : loading || !ready ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {/* Compatibility verdict */}
            <section>
              {verdict == null ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("flow.upgradeDiff.checking")}
                </div>
              ) : errors.length > 0 ? (
                <VerdictBlock
                  tone="error"
                  icon={<XCircle className="h-4 w-4" />}
                  title={t("flow.upgradeDiff.verdict.errors")}
                >
                  <IssueList t={t} issues={errors} />
                </VerdictBlock>
              ) : warnings.length > 0 ? (
                <VerdictBlock
                  tone="warning"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title={t("flow.upgradeDiff.verdict.warnings")}
                >
                  <IssueList t={t} issues={warnings} />
                </VerdictBlock>
              ) : (
                <VerdictBlock
                  tone="ok"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title={t("flow.upgradeDiff.verdict.ok")}
                />
              )}
              <p className="text-muted-foreground mt-1.5 text-[11px]">
                {t("flow.upgradeDiff.macroCaveat")}
              </p>
            </section>

            {/* Cell-level changes */}
            <section>
              <h4 className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
                {t("flow.upgradeDiff.cellChanges")}
              </h4>
              {cellChanges.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("flow.upgradeDiff.noCellChanges")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {cellChanges.map((change) => (
                    <li key={change.cellId} className="flex items-center gap-2 text-sm">
                      <Badge
                        variant={change.type === "removed" ? "destructive" : "secondary"}
                        className="w-16 justify-center text-[10px] capitalize"
                      >
                        {t(`flow.upgradeDiff.change.${change.type}`)}
                      </Badge>
                      <span className="text-muted-foreground text-xs capitalize">
                        {change.cellType}
                      </span>
                      {change.label ? <span className="truncate">{change.label}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Entity code changes */}
            {totalRefs > 0 ? (
              <section>
                <h4 className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
                  {t("flow.upgradeDiff.codeChanges")}
                </h4>
                <div className="space-y-2">
                  {[...referenced.protocols].map(([id, name]) => (
                    <ProtocolDiffRow
                      key={id}
                      id={id}
                      oldCode={pinned.entitySnapshots?.protocols[id]?.code}
                      fallbackName={name}
                      onResolved={handleResolved}
                    />
                  ))}
                  {[...referenced.macros].map(([id, name]) => (
                    <MacroDiffRow
                      key={id}
                      id={id}
                      oldCode={
                        (pinned.entitySnapshots?.macros[id] as { code?: string } | undefined)?.code
                      }
                      fallbackName={name}
                      onResolved={handleResolved}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpgrading}>
            {t("cancel")}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isUpgrading || !ready || failed || verdict == null || errors.length > 0}
          >
            {isUpgrading ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                {t("flow.upgradeDiff.upgrading")}
              </>
            ) : (
              <>
                <ArrowUpCircle className="mr-1.5 h-4 w-4" />
                {t("flow.confirmUpgrade")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerdictBlock({
  tone,
  icon,
  title,
  children,
}: {
  tone: "ok" | "warning" | "error";
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2.5",
        tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "error" && "border-red-200 bg-red-50 text-red-800",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function IssueList({
  t,
  issues,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  issues: WorkbookIssue[];
}) {
  return (
    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
      {issues.map((issue, i) => (
        <li key={`${issue.code}-${issue.cellId ?? ""}-${issue.ref ?? ""}-${i}`}>
          {issueMessage(t, issue)}
        </li>
      ))}
    </ul>
  );
}
