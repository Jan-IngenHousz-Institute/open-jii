"use client";

import { useExperimentStandardsFields } from "~/hooks/experiment/useExperimentStandardsFields/useExperimentStandardsFields";

import type {
  FilledStandardField,
  StandardField,
  StandardId,
  StepReasonCode,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";

import { FilledFieldsList } from "./filled-fields-list";
import { MissingFieldGroup } from "./missing-field-group";
import type { MissingFieldGroup as MissingFieldGroupData } from "./missing-field-groups";
import { groupMissingFields } from "./missing-field-groups";
import { ValidatorVerdictLine } from "./validator-verdict-line";

function isFilled(field: StandardField): field is FilledStandardField {
  return field.status === "filled";
}

interface StandardFieldsSheetProps {
  experimentId: string;
  standard: StandardId;
  /** Opened from a step, that step's fields lead. */
  first?: StepReasonCode;
  canFix: boolean;
  onClose: () => void;
}

/** The field-by-field panel: what one standard still lacks, grouped by the step that fills it. */
export function StandardFieldsSheet({
  experimentId,
  standard,
  first,
  canFix,
  onClose,
}: StandardFieldsSheetProps) {
  const { t } = useTranslation("standards");
  const { data, isLoading, isError, refetch } = useExperimentStandardsFields(
    experimentId,
    standard,
  );

  const name = t(`standard.${standard}.name`);
  const hasValidator = standard === "miappe";

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleRetry = () => {
    void refetch();
  };

  const renderGroup = (group: MissingFieldGroupData) => (
    <MissingFieldGroup
      key={group.reason.code}
      experimentId={experimentId}
      group={group}
      canFix={canFix}
    />
  );

  const body = () => {
    if (isLoading) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (isError || data === undefined) {
      return (
        <EmptyState
          variant="error"
          description={t("panel.loadError")}
          action={
            <Button variant="outline" size="sm" onClick={handleRetry}>
              {t("panel.retry")}
            </Button>
          }
        />
      );
    }

    const groups = groupMissingFields(data.fields, first);
    const filled = data.fields.filter(isFilled);

    return (
      <>
        {hasValidator ? <ValidatorVerdictLine verdict={data.validator} /> : null}

        {groups.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t("panel.missing")}</h3>
            {groups.map(renderGroup)}
          </div>
        ) : null}

        {filled.length > 0 ? <FilledFieldsList fields={filled} /> : null}
      </>
    );
  };

  const counted = data
    ? t("named", {
        name,
        detail: t("panel.filledCount", { filled: data.filled, total: data.total }),
      })
    : name;

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-120 flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-border border-b px-6 py-4">
          <SheetTitle>{t(`standard.${standard}.title`)}</SheetTitle>
          <SheetDescription>{counted}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6" data-testid="standard-fields">
          {body()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
