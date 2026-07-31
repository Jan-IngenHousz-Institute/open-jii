"use client";

import { useLocale } from "@/hooks/useLocale";
import { useWorkbookDelete } from "@/hooks/workbook/useWorkbookDelete/useWorkbookDelete";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";

import { FEATURE_FLAGS } from "@repo/analytics";
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
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

interface WorkbookDangerZoneProps {
  workbookId: string;
  workbookName: string;
  /** Experiments currently using this workbook (`experimentCount`). */
  usedBy: number;
  /** `can(manage)` from the detail response. */
  canManage: boolean;
}

/**
 * Delete moved off list rows because only detail responses carry `canManage`;
 * otherwise readers of public/shared workbooks saw an action that could only 403.
 * The separate feature flag remains because deleting an in-use workbook unlinks
 * experiments and loses their measurement flow.
 */
export function WorkbookDangerZone({
  workbookId,
  workbookName,
  usedBy,
  canManage,
}: WorkbookDangerZoneProps) {
  const { t } = useTranslation("workbook");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);

  const workbookDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.WORKBOOK_DELETION);
  const { mutate: deleteWorkbook, isPending: isDeleting } = useWorkbookDelete();

  if (!canManage) return null;
  if (usedBy > 0 && workbookDeletionEnabled !== true) return null;

  const handleDelete = () => {
    deleteWorkbook(
      { id: workbookId },
      {
        onSuccess: () => {
          toast({ title: t("workbooks.messages.deleteSuccess") });
          setConfirming(false);
          // The workbook this page is showing no longer exists.
          router.push(`/${locale}/platform/workbooks`);
        },
      },
    );
  };

  return (
    <section className="space-y-2">
      <h4 className="text-destructive text-base font-medium">{t("workbooks.dangerZone")}</h4>
      <p className="text-muted-foreground text-sm">
        {usedBy > 0
          ? t("workbooks.messages.deleteInUseWarning", { count: usedBy })
          : t("workbooks.deleteWarning")}
      </p>
      <Button variant="destructive" onClick={() => setConfirming(true)} disabled={isDeleting}>
        {t("workbooks.actions.delete")}
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workbooks.actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {usedBy > 0
                ? t("workbooks.messages.deleteInUseConfirm", { name: workbookName, count: usedBy })
                : t("workbooks.messages.deleteConfirm", { name: workbookName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("workbooks.actions.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
