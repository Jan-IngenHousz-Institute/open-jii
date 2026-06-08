"use client";

import { useAttachWorkbook } from "@/hooks/experiment/useAttachWorkbook/useAttachWorkbook";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { useWorkbookList } from "@/hooks/workbook/useWorkbookList/useWorkbookList";
import { BookOpen, LinkIcon, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

interface EmptyWorkbookStateProps {
  experimentId: string;
  experimentName: string;
  hasAccess: boolean;
}

export function EmptyWorkbookState({
  experimentId,
  experimentName,
  hasAccess,
}: EmptyWorkbookStateProps) {
  const { t } = useTranslation("experiments");
  const router = useRouter();
  const locale = useLocale();

  const attachWorkbook = useAttachWorkbook();
  const [selectedWorkbookId, setSelectedWorkbookId] = useState("");
  const { data: workbooks = [] } = useWorkbookList();

  // Create + attach + open in one step: a fresh workbook is only useful once it
  // is linked to this experiment and the user can start adding cells.
  const createWorkbook = useWorkbookCreate({
    onSuccess: (data) => {
      const workbookId = data.body.id;
      attachWorkbook.mutate(
        { params: { id: experimentId }, body: { workbookId } },
        {
          onSuccess: () => router.push(`/${locale}/platform/workbooks/${workbookId}`),
          onError: () => toast({ description: t("flow.attachFailed"), variant: "destructive" }),
        },
      );
    },
    onError: () => toast({ description: t("flow.createFailed"), variant: "destructive" }),
  });

  const isCreating = createWorkbook.isPending || attachWorkbook.isPending;

  const handleAttach = () => {
    if (!selectedWorkbookId) return;
    attachWorkbook.mutate(
      { params: { id: experimentId }, body: { workbookId: selectedWorkbookId } },
      {
        onSuccess: () => {
          toast({ description: t("flow.workbookAttached") });
          setSelectedWorkbookId("");
        },
        onError: () => {
          toast({ description: t("flow.attachFailed"), variant: "destructive" });
        },
      },
    );
  };

  const handleCreate = () => {
    createWorkbook.mutate({ body: { name: t("flow.newWorkbookName", { name: experimentName }) } });
  };

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium">{t("flow.title")}</h4>
        <p className="text-muted-foreground text-sm">{t("flow.description")}</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <BookOpen className="text-muted-foreground mb-4 h-12 w-12" />
        <p className="text-muted-foreground mb-1 text-sm font-medium">
          {t("flow.noWorkbookLinked")}
        </p>
        <p className="text-muted-foreground mb-6 text-xs">{t("flow.linkWorkbookPrompt")}</p>
        {hasAccess && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
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
              <Button
                onClick={handleAttach}
                disabled={!selectedWorkbookId || attachWorkbook.isPending}
                size="sm"
              >
                <LinkIcon className="mr-1.5 h-4 w-4" />
                {t("flow.attach")}
              </Button>
            </div>

            <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase">
              <span className="bg-border h-px w-8" />
              {t("flow.or")}
              <span className="bg-border h-px w-8" />
            </div>

            <Button onClick={handleCreate} disabled={isCreating} variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              {isCreating ? t("flow.creating") : t("flow.createNew")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
