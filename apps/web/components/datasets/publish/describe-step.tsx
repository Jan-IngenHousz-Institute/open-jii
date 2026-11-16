"use client";

import { SettingsCard } from "@/components/shared/settings-card";

import { useTranslation } from "@repo/i18n";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import { DatasetPeopleCard } from "./dataset-people-card";
import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DatasetPublishStepFrame } from "./dataset-publish-step-frame";

interface DescribeStepProps extends WizardStepProps<PublishDatasetForm> {
  datasetId: string;
}

export function DescribeStep({ datasetId, ...props }: DescribeStepProps) {
  const { t } = useTranslation("datasets");
  const { form } = props;

  return (
    <DatasetPublishStepFrame {...props}>
      <SettingsCard
        title={t("describe.detailsTitle")}
        description={t("describe.detailsDescription")}
        contentClassName="space-y-6"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("describe.titleLabel")}</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>{t("describe.descriptionLabel")}</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="limitations"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("describe.limitationsLabel")}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormDescription>{t("describe.limitationsHelp")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </SettingsCard>

      <DatasetPeopleCard form={form} datasetId={datasetId} />
    </DatasetPublishStepFrame>
  );
}
