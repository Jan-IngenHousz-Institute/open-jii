"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { BookOpenText, FileText, GitBranch, LayoutGrid, Rows3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DatasetScope, ScopeTable } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { FormField, FormItem, FormMessage } from "@repo/ui/components/form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DatasetPublishStepFrame } from "./dataset-publish-step-frame";
import { countScopeChoice } from "./scope-count";
import { ScopeDateField } from "./scope-date-field";
import { ScopeTableRow } from "./scope-table-row";

interface ScopeStepProps extends WizardStepProps<PublishDatasetForm> {
  scope: DatasetScope;
}

interface AlwaysItem {
  icon: LucideIcon;
  label: string;
  detail: string;
}

/** Which tables and dates go in. Single readings are Curate's, and the copy is Freeze's. */
export function ScopeStep({ scope, ...props }: ScopeStepProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);
  const { form } = props;
  const choice = form.watch("scope");
  const count = countScopeChoice(scope.tables, choice);

  const isIncluded = (table: ScopeTable) => choice.tables.some(({ name }) => name === table.name);

  const handleToggle = (table: ScopeTable) => {
    const tables = isIncluded(table)
      ? choice.tables.filter(({ name }) => name !== table.name)
      : [...choice.tables, { name: table.name, displayName: table.displayName }];
    form.setValue("scope.tables", tables, { shouldDirty: true, shouldValidate: true });
  };

  const renderTable = (table: ScopeTable) => (
    <ScopeTableRow
      key={table.name}
      table={table}
      isIncluded={isIncluded(table)}
      onToggle={handleToggle}
    />
  );

  const always: AlwaysItem[] = [
    { icon: BookOpenText, label: t("scope.dictionary"), detail: t("scope.dictionaryDetail") },
    { icon: LayoutGrid, label: t("scope.layout"), detail: t("scope.layoutDetail") },
    { icon: FileText, label: t("scope.studyDetails"), detail: t("scope.studyDetailsDetail") },
  ];

  const renderAlways = ({ icon: Icon, label, detail }: AlwaysItem) => (
    <li key={label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{detail}</p>
      </div>
    </li>
  );

  const versionDetail = () => {
    const { previous } = scope;
    if (previous === null) {
      return t("scope.firstVersionDetail");
    }
    const difference = count - previous.readingCount;
    const comparison = { previous: previous.version, previousCount: previous.readingCount };
    if (difference > 0) {
      return t("scope.versionMore", { ...comparison, difference });
    }
    if (difference < 0) {
      return t("scope.versionFewer", { ...comparison, difference: -difference });
    }
    return t("scope.versionSame", comparison);
  };

  return (
    <DatasetPublishStepFrame {...props}>
      <div className="space-y-6" data-testid="dataset-scope">
        <SettingsCard title={t("scope.tablesTitle")} description={t("scope.tablesDescription")}>
          <FormField
            control={form.control}
            name="scope.tables"
            render={() => (
              <FormItem>
                <ul className="divide-border divide-y">{scope.tables.map(renderTable)}</ul>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsCard>

        <SettingsCard title={t("scope.datesTitle")} description={t("scope.datesDescription")}>
          <div className="flex flex-col gap-4 sm:flex-row">
            <ScopeDateField form={form} name="scope.from" label={t("scope.from")} />
            <ScopeDateField form={form} name="scope.to" label={t("scope.to")} />
          </div>
        </SettingsCard>

        <div className="bg-muted flex items-start gap-3 rounded-lg p-4" data-testid="scope-count">
          <Rows3 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium tabular-nums">
              {t("scope.choice", { count, time: format.dateTime(scope.countedAt) })}
            </p>
            <p className="text-muted-foreground text-sm">{t("scope.choiceNote")}</p>
          </div>
        </div>
      </div>

      <SettingsCard title={t("scope.alwaysTitle")}>
        <ul className="divide-border divide-y">{always.map(renderAlways)}</ul>
      </SettingsCard>

      <div className="bg-muted flex items-start gap-3 rounded-lg p-4">
        <GitBranch className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-medium">
            {t("scope.versionTitle", { version: scope.version })}
          </p>
          <p className="text-muted-foreground text-sm">{versionDetail()}</p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">{t("scope.publicExperimentNote")}</p>
    </DatasetPublishStepFrame>
  );
}
