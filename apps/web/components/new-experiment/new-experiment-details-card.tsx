import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { RichTextarea } from "@repo/ui/components/rich-textarea";

import { OrganizationPicker } from "../organizations/organization-picker";
import { WorkbookSelect } from "../workbook/workbook-select";

interface NewExperimentDetailsCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentDetailsCard({ form }: NewExperimentDetailsCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("newExperiment.detailsTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.detailsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.name")}</FormLabel>
              <FormControl>
                <Input {...field} trim />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.description_field")}</FormLabel>
              <FormControl>
                <RichTextarea
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("newExperiment.descriptionPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="workbookId"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.workbook")}</FormLabel>
              <WorkbookSelect
                value={field.value ?? undefined}
                onChange={(id) => field.onChange(id ?? undefined)}
                triggerPlaceholder={t("newExperiment.workbookPlaceholder")}
                searchPlaceholder={t("newExperiment.searchWorkbook")}
                emptyText={t("newExperiment.noWorkbooksFound")}
                noneLabel={t("newExperiment.noWorkbook")}
                invalid={!!fieldState.error}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="organizationId"
          render={({ field }) => (
            <FormItem>
              <OrganizationPicker
                id="new-experiment-organization"
                value={field.value ?? undefined}
                onChange={(organizationId) => field.onChange(organizationId ?? undefined)}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
