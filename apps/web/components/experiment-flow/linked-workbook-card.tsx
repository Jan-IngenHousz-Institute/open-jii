"use client";

import { WorkbookVersionBadge } from "@/components/workbook/workbook-version-badge";
import { useAttachWorkbook } from "@/hooks/experiment/useAttachWorkbook/useAttachWorkbook";
import { useDetachWorkbook } from "@/hooks/experiment/useDetachWorkbook/useDetachWorkbook";
import { useUpgradeWorkbookVersion } from "@/hooks/experiment/useUpgradeWorkbookVersion/useUpgradeWorkbookVersion";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useWorkbookList } from "@/hooks/workbook/useWorkbookList/useWorkbookList";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { useWorkbookVersions } from "@/hooks/workbook/useWorkbookVersions/useWorkbookVersions";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import {
  ArrowUpCircle,
  Check,
  ExternalLink,
  History,
  LinkIcon,
  Loader2,
  Pencil,
  Sparkles,
  Unlink,
  X,
} from "lucide-react";
import NextLink from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";

import { useTranslation } from "@repo/i18n/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

import { WorkbookUpgradeDialog } from "../workbook/upgrade/workbook-upgrade-dialog";
import { WorkbookVersionHistoryDialog } from "../workbook/upgrade/workbook-version-history-dialog";
import { WorkbookSelect } from "../workbook/workbook-select";

interface LinkedWorkbookCardProps {
  experimentId: string;
  locale: string;
  workbookId: string;
  workbookVersionId: string;
  hasAccess: boolean;
  /** Whether the current user owns the workbook (renaming is owner-only). */
  isWorkbookOwner?: boolean;
}

export function LinkedWorkbookCard({
  experimentId,
  locale,
  workbookId,
  workbookVersionId,
  hasAccess,
  isWorkbookOwner = false,
}: LinkedWorkbookCardProps) {
  const { t } = useTranslation("experiments");

  const { data: workbook } = useWorkbook(workbookId, { enabled: !!workbookId });

  const { data: versionsData } = useWorkbookVersions(workbookId, {
    enabled: !!workbookId,
  });
  const versions = versionsData?.body ?? [];
  const pinnedVersion = versions.find((v) => v.id === workbookVersionId);
  const latestVersion = versions[0];

  const hasNewerPublished =
    !!pinnedVersion && versions.length > 0 && latestVersion.version > pinnedVersion.version;

  // Freeze the upgrade indicator while any workbook read/write is mid-flight
  // (autosave, auto-apply upgrade, refetch); otherwise the recomputed
  // `isUpgradable` flag flips transiently and flashes the banner on and off.
  const fetchingWorkbook = useIsFetching({ queryKey: ["workbook", workbookId] });
  const fetchingVersions = useIsFetching({ queryKey: ["workbookVersions", workbookId] });
  const savingWorkbook = useIsMutating({ mutationKey: ["workbook", workbookId, "update"] });
  const upgradingWorkbook = useIsMutating({
    mutationKey: ["experiment", experimentId, "upgradeWorkbook"],
  });
  // History restore/roll-forward repins the version too; freeze the banner while
  // it is in flight so `isUpgradable` does not flicker mid-mutation.
  const settingVersion = useIsMutating({
    mutationKey: ["experiment", experimentId, "setWorkbookVersion"],
  });
  const isSyncing =
    fetchingWorkbook + fetchingVersions + savingWorkbook + upgradingWorkbook + settingVersion > 0;

  const liveHasUpgrade = hasNewerPublished || workbook?.isUpgradable === true;
  const settledHasUpgradeRef = useRef(liveHasUpgrade);
  if (!isSyncing) settledHasUpgradeRef.current = liveHasUpgrade;
  const hasUpgrade = settledHasUpgradeRef.current;

  const attachWorkbook = useAttachWorkbook();
  const [selectedWorkbookId, setSelectedWorkbookId] = useState("");
  const { data: workbooks = [] } = useWorkbookList();
  const [isChanging, setIsChanging] = useState(false);

  const renameWorkbook = useWorkbookUpdate(workbookId);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const canRename = hasAccess && isWorkbookOwner;

  const startRename = () => {
    setNameDraft(workbook?.name ?? "");
    setIsRenaming(true);
  };

  const handleRename = () => {
    const next = nameDraft.trim();
    if (!next || next === workbook?.name) {
      setIsRenaming(false);
      return;
    }
    renameWorkbook.mutate(
      { params: { id: workbookId }, body: { name: next } },
      {
        onSuccess: () => {
          toast({ description: t("flow.workbookRenamed") });
          setIsRenaming(false);
        },
        onError: () => {
          toast({ description: t("flow.renameFailed"), variant: "destructive" });
        },
      },
    );
  };

  const handleAttach = () => {
    if (!selectedWorkbookId) return;
    attachWorkbook.mutate(
      { params: { id: experimentId }, body: { workbookId: selectedWorkbookId } },
      {
        onSuccess: () => {
          toast({ description: t("flow.workbookAttached") });
          setSelectedWorkbookId("");
          setIsChanging(false);
        },
        onError: () => {
          toast({ description: t("flow.attachFailed"), variant: "destructive" });
        },
      },
    );
  };

  const detachWorkbook = useDetachWorkbook();

  const handleDetach = () => {
    detachWorkbook.mutate(
      { params: { id: experimentId } },
      {
        onSuccess: () => {
          toast({ description: t("flow.workbookDetached") });
        },
        onError: () => {
          toast({ description: t("flow.detachFailed"), variant: "destructive" });
        },
      },
    );
  };

  const upgradeVersion = useUpgradeWorkbookVersion(experimentId);
  const [upgradeState, setUpgradeState] = useState<"idle" | "upgrading" | "success">("idle");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (upgradeState === "success") {
      const timer = setTimeout(() => setUpgradeState("idle"), 2500);
      return () => clearTimeout(timer);
    }
  }, [upgradeState]);

  const handleUpgrade = useCallback(() => {
    setUpgradeState("upgrading");
    upgradeVersion.mutate(
      { params: { id: experimentId } },
      {
        onSuccess: () => {
          setReviewOpen(false);
          setUpgradeState("success");
        },
        onError: () => {
          setUpgradeState("idle");
          toast({ description: t("flow.upgradeFailed"), variant: "destructive" });
        },
      },
    );
  }, [experimentId, upgradeVersion, t]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isRenaming ? (
                <>
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRename();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setIsRenaming(false);
                      }
                    }}
                    className="h-7 w-56 text-sm font-semibold"
                    autoFocus
                    disabled={renameWorkbook.isPending}
                    aria-label={t("flow.renameWorkbook")}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={handleRename}
                    disabled={renameWorkbook.isPending}
                    aria-label={t("flow.saveRename")}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setIsRenaming(false)}
                    disabled={renameWorkbook.isPending}
                    aria-label={t("cancel")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <NextLink
                    href={`/${locale}/platform/workbooks/${workbookId}`}
                    target="_blank"
                    className="text-foreground truncate text-sm font-semibold hover:underline"
                  >
                    {workbook?.name ?? t("flow.title")}
                    <ExternalLink className="ml-1 inline h-3 w-3 align-baseline opacity-50" />
                  </NextLink>
                  {pinnedVersion && (
                    <span className={upgradeState === "success" ? "animate-version-pop" : ""}>
                      <WorkbookVersionBadge
                        currentVersion={pinnedVersion.version}
                        latestVersion={latestVersion.version}
                        showUpgrade={false}
                      />
                    </span>
                  )}
                  {pinnedVersion && (
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(true)}
                      aria-label={t("flow.versionHistory.open")}
                      title={t("flow.versionHistory.open")}
                      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 transition-colors"
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canRename && (
                    <button
                      type="button"
                      onClick={startRename}
                      aria-label={t("flow.renameWorkbook")}
                      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        {hasAccess && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsChanging(!isChanging)}>
              {t("flow.changeWorkbook")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={detachWorkbook.isPending}>
                  <Unlink className="mr-1.5 h-4 w-4" />
                  {t("flow.detach")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("flow.confirmDetachTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("flow.confirmDetachMessage")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDetach}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("flow.detach")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {hasUpgrade && hasAccess && pinnedVersion && upgradeState !== "success" && (
        <div
          className={cn(
            "flex items-center justify-between gap-4 border-t px-4 py-2.5 transition-colors duration-300",
            upgradeState === "upgrading"
              ? "animate-shimmer bg-gradient-to-r from-[#CCFCD8]/20 via-[#CCFCD8]/50 to-[#CCFCD8]/20 bg-[length:200%_100%]"
              : "bg-[#CCFCD8]/30",
          )}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              className={cn(
                "h-3.5 w-3.5 text-emerald-600 transition-transform duration-300",
                upgradeState === "upgrading" && "animate-spin",
              )}
            />
            <p className="text-muted-foreground text-xs">
              {hasNewerPublished ? (
                <>
                  v{latestVersion.version} is available{" "}
                  <span className="text-muted-foreground/70">
                    (currently on v{pinnedVersion.version})
                  </span>
                </>
              ) : (
                <>
                  Workbook has updates available{" "}
                  <span className="text-muted-foreground/70">
                    (currently on v{pinnedVersion.version})
                  </span>
                </>
              )}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            disabled={upgradeState === "upgrading"}
            onClick={() => setReviewOpen(true)}
          >
            {upgradeState === "upgrading" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("flow.upgradeDiff.upgrading")}
              </>
            ) : (
              <>
                <ArrowUpCircle className="h-3 w-3" />
                {t("flow.reviewAndUpgrade")}
              </>
            )}
          </Button>
        </div>
      )}

      {upgradeState === "success" && (
        <div className="animate-version-pop flex items-center gap-2 border-t bg-[#CCFCD8]/50 px-4 py-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-3 w-3 text-white" />
          </div>
          <p className="text-xs font-medium text-emerald-800">
            Upgraded to v{latestVersion.version}
          </p>
        </div>
      )}

      {isChanging && hasAccess && (
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <WorkbookSelect
            workbooks={workbooks}
            value={selectedWorkbookId || undefined}
            onChange={(id) => setSelectedWorkbookId(id ?? "")}
            triggerPlaceholder={t("flow.selectWorkbook")}
            searchPlaceholder={t("flow.searchWorkbook")}
            emptyText={t("flow.noWorkbooksFound")}
            triggerClassName="w-64"
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!selectedWorkbookId || attachWorkbook.isPending} size="sm">
                <LinkIcon className="mr-1.5 h-4 w-4" />
                {t("flow.attach")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("flow.confirmChangeTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("flow.confirmChangeMessage")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleAttach}>
                  {t("flow.confirmChange")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="sm" onClick={() => setIsChanging(false)}>
            {t("cancel")}
          </Button>
        </div>
      )}

      {pinnedVersion && (
        <WorkbookUpgradeDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          workbookId={workbookId}
          pinnedVersionId={workbookVersionId}
          currentVersion={pinnedVersion.version}
          targetVersionLabel={`v${hasNewerPublished ? latestVersion.version : pinnedVersion.version + 1}`}
          onConfirm={handleUpgrade}
          isUpgrading={upgradeState === "upgrading"}
        />
      )}

      <WorkbookVersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        experimentId={experimentId}
        workbookId={workbookId}
        currentVersionId={workbookVersionId}
        canManage={hasAccess}
      />
    </div>
  );
}
