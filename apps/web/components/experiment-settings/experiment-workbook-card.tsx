"use client";

import type { Experiment } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  CardContent,
  CardHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

import { useAttachWorkbook } from "../../hooks/experiment/useAttachWorkbook/useAttachWorkbook";
import { useDetachWorkbook } from "../../hooks/experiment/useDetachWorkbook/useDetachWorkbook";
import { useWorkbookList } from "../../hooks/workbook/useWorkbookList/useWorkbookList";

interface ExperimentWorkbookCardProps {
  experimentId: string;
  experiment: Experiment;
  isArchived?: boolean;
}

export function ExperimentWorkbookCard({
  experimentId,
  experiment,
  isArchived = false,
}: ExperimentWorkbookCardProps) {
  const { t } = useTranslation();
  const attachWorkbook = useAttachWorkbook();
  const detachWorkbook = useDetachWorkbook();

  const { data: workbooks = [] } = useWorkbookList();

  const handleChange = (value: string) => {
    if (value === "__none__") {
      detachWorkbook.mutate({ params: { id: experimentId } });
    } else {
      attachWorkbook.mutate({
        params: { id: experimentId },
        body: { workbookId: value },
      });
    }
  };

  const isPending = attachWorkbook.isPending || detachWorkbook.isPending;

  return (
    <>
      <CardHeader>
        <h4 className="text-sm font-medium">{t("newExperiment.workbook")}</h4>
      </CardHeader>
      <CardContent>
        <Select
          onValueChange={handleChange}
          value={experiment.workbookId ?? "__none__"}
          disabled={isArchived || isPending}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("newExperiment.workbookPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("newExperiment.noWorkbook")}</SelectItem>
            {workbooks.map((wb) => (
              <SelectItem key={wb.id} value={wb.id}>
                {wb.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </>
  );
}
