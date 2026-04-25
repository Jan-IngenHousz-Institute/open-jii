"use client";

import { useLocale } from "@/hooks/useLocale";
import { useWorkbookDelete } from "@/hooks/workbook/useWorkbookDelete/useWorkbookDelete";
import { formatDate } from "@/util/date";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Workbook } from "@repo/api/schemas/workbook.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";

import { DetailsSidebarCard } from "../shared/details-sidebar-card";

interface WorkbookDetailsSidebarProps {
  workbookId: string;
  workbook: Workbook;
}

export function WorkbookDetailsSidebar({ workbookId, workbook }: WorkbookDetailsSidebarProps) {
  const { t } = useTranslation(["workbook", "common"]);
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const locale = useLocale();
  const router = useRouter();

  const isCreator = session?.user.id === workbook.createdBy;

  const { mutateAsync: deleteWorkbook, isPending: isDeleting } = useWorkbookDelete();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    await deleteWorkbook({ params: { id: workbookId } });
    setIsDeleteDialogOpen(false);
    router.push(`/${locale}/platform/workbooks`);
  };

  return (
    <DetailsSidebarCard
      title={t("workbooks.detailsTitle")}
      collapsedSummary={`${tCommon("common.updated")} ${formatDate(workbook.updatedAt)}, ${t("workbooks.workbookId")} ${workbook.id.slice(0, 8)}...`}
    >
      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("workbooks.workbookId")}</h4>
        <p className="text-muted-foreground font-mono text-sm">{workbook.id}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.updated")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(workbook.updatedAt)}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.created")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(workbook.createdAt)}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.createdBy")}</h4>
        <p className="text-muted-foreground text-sm">{workbook.createdByName ?? "-"}</p>
      </div>

      {/* Danger Zone */}
      {isCreator && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            className="text-muted-foreground border-t"
          />
          <div>
            <h5 className="text-destructive mb-2 text-base font-medium">
              {t("workbooks.deleteWorkbook")}
            </h5>
            <p className="text-muted-foreground mb-4 text-sm">
              {t("workbooks.deleteWorkbookDescription")}
            </p>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">{t("workbooks.deleteWorkbook")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive">
                    {t("workbooks.deleteWorkbook")}
                  </DialogTitle>
                  <DialogDescription>
                    {tCommon("common.confirmDelete", { name: workbook.name })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    {tCommon("common.cancel")}
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? tCommon("common.deleting") : t("workbooks.deleteWorkbook")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}
    </DetailsSidebarCard>
  );
}
