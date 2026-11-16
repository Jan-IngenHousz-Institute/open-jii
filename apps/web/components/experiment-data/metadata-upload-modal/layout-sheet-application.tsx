"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { LayoutSheetApplication } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { zLayoutSheetApplication } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n/client";
import { Form } from "@repo/ui/components/form";

import { AttributeChangeFields } from "../../experiment-layout/attribute-change-fields";

// The en-CA locale writes a local calendar date as YYYY-MM-DD.
function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * Asked when a sheet is attached while plots already carry values: whether it applies from a date,
 * so earlier readings keep the values they have, or corrects the current values.
 */
export function LayoutSheetApplicationChoice() {
  const { t } = useTranslation("experiments");

  // Scaffold: saving a sheet as versions is not built yet, so the choice stays in this form.
  const form = useForm<LayoutSheetApplication>({
    resolver: zodResolver(zLayoutSheetApplication),
    defaultValues: { kind: "planned", appliesFrom: today(), reason: null },
  });

  const labels = {
    planned: t("layout.sheetApplication.planned"),
    plannedHelp: t("layout.sheetApplication.plannedHelp"),
    correction: t("layout.sheetApplication.correction"),
    correctionHelp: t("layout.sheetApplication.correctionHelp"),
  };

  return (
    <div className="space-y-3 rounded-md border px-3 py-3" data-sheet-application>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{t("layout.sheetApplication.title")}</p>
        <p className="text-muted-foreground text-xs">{t("layout.sheetApplication.description")}</p>
      </div>
      <Form {...form}>
        <AttributeChangeFields labels={labels} />
      </Form>
    </div>
  );
}
