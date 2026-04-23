"use client";

import { useAttachWorkbook } from "@/hooks/experiment/useAttachWorkbook/useAttachWorkbook";
import { useWorkbookList } from "@/hooks/workbook/useWorkbookList/useWorkbookList";
import { BookOpen, LinkIcon } from "lucide-react";
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
  hasAccess: boolean;
}

export function EmptyWorkbookState({ experimentId, hasAccess }: EmptyWorkbookStateProps) {
  const { t } = useTranslation("experiments");

  const attachWorkbook = useAttachWorkbook();
  const [selectedWorkbookId, setSelectedWorkbookId] = useState("");
  const { data: workbooks = [] } = useWorkbookList();

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
        )}
      </div>
    </div>
  );
}
