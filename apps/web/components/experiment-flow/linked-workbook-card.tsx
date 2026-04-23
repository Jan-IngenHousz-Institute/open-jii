"use client";

import { WorkbookVersionBadge } from "@/components/workbook/workbook-version-badge";
import { useAttachWorkbook } from "@/hooks/experiment/useAttachWorkbook/useAttachWorkbook";
import { useDetachWorkbook } from "@/hooks/experiment/useDetachWorkbook/useDetachWorkbook";
import { useUpgradeWorkbookVersion } from "@/hooks/experiment/useUpgradeWorkbookVersion/useUpgradeWorkbookVersion";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useWorkbookList } from "@/hooks/workbook/useWorkbookList/useWorkbookList";
import { useWorkbookVersions } from "@/hooks/workbook/useWorkbookVersions/useWorkbookVersions";
import {
  ArrowUpCircle,
  BookOpen,
  Check,
  ExternalLink,
  LinkIcon,
  Loader2,
  Sparkles,
  Unlink,
} from "lucide-react";
import NextLink from "next/link";
import { useState, useEffect, useCallback } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

interface LinkedWorkbookCardProps {
  experimentId: string;
  locale: string;
  workbookId: string;
  workbookVersionId: string;
  hasAccess: boolean;
}

export function LinkedWorkbookCard({
  experimentId,
  locale,
  workbookId,
  workbookVersionId,
  hasAccess,
}: LinkedWorkbookCardProps) {
  const { t } = useTranslation("experiments");

  const { data: workbook } = useWorkbook(workbookId, { enabled: !!workbookId });

  const { data: versionsData } = useWorkbookVersions(workbookId, {
    enabled: !!workbookId,
  });
  const versions = versionsData?.body ?? [];
  const pinnedVersion = versions.find((v) => v.id === workbookVersionId);
  const latestVersion = versions[0];
  const hasUpgrade =
    !!pinnedVersion && versions.length > 0 && latestVersion.version > pinnedVersion.version;

  // Attach (change) workbook
  const attachWorkbook = useAttachWorkbook();
  const [selectedWorkbookId, setSelectedWorkbookId] = useState("");
  const { data: workbooks = [] } = useWorkbookList();
  const [isChanging, setIsChanging] = useState(false);

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

  // Detach workbook
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

  // Upgrade workbook version
  const upgradeVersion = useUpgradeWorkbookVersion();
  const [upgradeState, setUpgradeState] = useState<"idle" | "upgrading" | "success">("idle");

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
          setUpgradeState("success");
          toast({ description: t("flow.versionUpgraded") });
        },
        onError: () => {
          setUpgradeState("idle");
          toast({ description: t("flow.upgradeFailed"), variant: "destructive" });
        },
      },
    );
  }, [experimentId, upgradeVersion, t]);

  return (
    <div className="rounded-lg border shadow-none">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <BookOpen className="text-muted-foreground h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
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
            </div>
            <p className="text-muted-foreground text-xs">{t("flow.description")}</p>
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

      {/* Upgrade notice */}
      {hasUpgrade && hasAccess && upgradeState !== "success" && (
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
              v{latestVersion.version} is available{" "}
              <span className="text-muted-foreground/70">
                (currently on v{pinnedVersion.version})
              </span>
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            onClick={handleUpgrade}
            disabled={upgradeState === "upgrading"}
          >
            {upgradeState === "upgrading" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Upgrading…
              </>
            ) : (
              <>
                <ArrowUpCircle className="h-3 w-3" />
                {t("flow.upgradeToLatest", { version: latestVersion.version })}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Upgrade success banner */}
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

      {/* Change workbook inline picker */}
      {isChanging && hasAccess && (
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Select value={selectedWorkbookId} onValueChange={setSelectedWorkbookId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t("newExperiment.workbookPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {workbooks.map((wb) => (
                <SelectItem key={wb.id} value={wb.id}>
                  {wb.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    </div>
  );
}
