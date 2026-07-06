"use client";

import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { Info } from "lucide-react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import { zVisibility } from "@repo/api/schemas/workbook.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

type Visibility = (typeof zVisibility.enum)[keyof typeof zVisibility.enum];

interface WorkbookVisibilityCardProps {
  id: string;
  initialVisibility: Visibility;
  canManage: boolean;
}

export function WorkbookVisibilityCard({
  id,
  initialVisibility,
  canManage,
}: WorkbookVisibilityCardProps) {
  const { t } = useTranslation("workbook");
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync: updateWorkbook, isPending: isUpdating } = useWorkbookUpdate(id);
  const [currentVisibility, setCurrentVisibility] = useState<Visibility>(initialVisibility);
  const [showDialog, setShowDialog] = useState(false);

  const isPublic = currentVisibility === "public";

  const confirmPublish = async () => {
    await updateWorkbook(
      { params: { id }, body: { visibility: "public" } },
      {
        onSuccess: () => {
          setCurrentVisibility("public");
          setShowDialog(false);
          toast({ description: t("workbooks.workbookUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
        {t("workbookVisibility.visibility")}
      </span>
      {canManage && !isPublic ? (
        <Select
          value={currentVisibility}
          onValueChange={(value) => {
            if (value === "public") setShowDialog(true);
          }}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(zVisibility.enum).map((value) => (
              <SelectItem key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="flex items-center gap-1 text-sm leading-[21px] text-[#68737B]">
          {isPublic ? t("workbookVisibility.public") : t("workbookVisibility.private")}
          {isPublic && <Info className="text-primary h-3.5 w-3.5" />}
        </span>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workbookVisibility.changeToPublicTitle")}</DialogTitle>
            <DialogDescription>
              {t("workbookVisibility.changeToPublicDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isUpdating}>
              {tCommon("common.cancel")}
            </Button>
            <Button onClick={confirmPublish} disabled={isUpdating}>
              {tCommon("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
