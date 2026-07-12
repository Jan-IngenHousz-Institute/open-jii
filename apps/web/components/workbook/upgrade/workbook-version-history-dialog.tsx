"use client";

import { useSetWorkbookVersion } from "@/hooks/experiment/useSetWorkbookVersion/useSetWorkbookVersion";
import { useWorkbookVersions } from "@/hooks/workbook/useWorkbookVersions/useWorkbookVersions";
import { formatDate } from "@/util/date";
import { History, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { toast } from "@repo/ui/hooks/use-toast";

interface VersionSummary {
  id: string;
  version: number;
  createdAt: string;
}

interface WorkbookVersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experimentId: string;
  workbookId: string;
  /** The version the experiment is currently pinned to. */
  currentVersionId: string;
  /** Experiment admins may restore a version; everyone else views only. */
  canManage: boolean;
}

export function WorkbookVersionHistoryDialog({
  open,
  onOpenChange,
  experimentId,
  workbookId,
  currentVersionId,
  canManage,
}: WorkbookVersionHistoryDialogProps) {
  const { t } = useTranslation("experiments");
  const { data, isLoading } = useWorkbookVersions(workbookId, { enabled: open });
  const versions = (data?.body ?? []) as VersionSummary[];

  const setVersion = useSetWorkbookVersion(experimentId);
  const [pending, setPending] = useState<VersionSummary | null>(null);

  const handleRestore = (e: React.MouseEvent) => {
    // Keep the alert open while the mutation runs so the pending spinner shows;
    // AlertDialogAction would otherwise close it on click.
    e.preventDefault();
    if (!pending) return;
    const target = pending;
    setVersion.mutate(
      { params: { id: experimentId }, body: { versionId: target.id } },
      {
        onSuccess: () => {
          toast({ description: t("flow.versionHistory.restored", { version: target.version }) });
          setPending(null);
          onOpenChange(false);
        },
        onError: () => {
          toast({ description: t("flow.versionHistory.restoreFailed"), variant: "destructive" });
          setPending(null);
        },
      },
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("flow.versionHistory.title")}
            </DialogTitle>
            <DialogDescription>{t("flow.versionHistory.subtitle")}</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("flow.versionHistory.empty")}
            </p>
          ) : (
            <ul className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
              {versions.map((v) => {
                const isCurrent = v.id === currentVersionId;
                return (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        v{v.version}
                        {isCurrent ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {t("flow.versionHistory.current")}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground text-xs">{formatDate(v.createdAt)}</div>
                    </div>
                    {canManage && !isCurrent ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setPending(v)}
                        disabled={setVersion.isPending}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        {t("flow.versionHistory.restore")}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("flow.versionHistory.restoreConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("flow.versionHistory.restoreConfirmMessage", { version: pending?.version ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setVersion.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={setVersion.isPending}>
              {setVersion.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-4 w-4" />
              )}
              {t("flow.versionHistory.restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
