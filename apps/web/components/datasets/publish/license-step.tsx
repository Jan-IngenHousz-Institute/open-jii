"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { Info, Lock, TriangleAlert } from "lucide-react";

import type { DatasetAccess } from "@repo/api/domains/dataset/dataset.schema";
import { zDatasetAccess } from "@repo/api/domains/dataset/dataset.schema";
import type { DataLicense } from "@repo/api/domains/experiment/experiment.schema";
import { zDataLicense } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { RadioGroup } from "@repo/ui/components/radio-group";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import { LICENSE_KEYS } from "../license-keys";
import { ChoiceOption } from "./choice-option";
import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DatasetPublishStepFrame } from "./dataset-publish-step-frame";
import { EmbargoDateField } from "./embargo-date-field";

export function LicenseStep(props: WizardStepProps<PublishDatasetForm>) {
  const { t } = useTranslation("datasets");
  const { form } = props;
  const access = form.watch("access");
  const license = form.watch("license");
  const isEmbargoed = access === "embargoed";
  const isShareAlike = license === "CC-BY-SA-4.0";

  const handleLicenseChange = (value: string) => {
    const next = zDataLicense.options.find((option) => option === value);
    if (next !== undefined) {
      form.setValue("license", next, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleAccessChange = (value: string) => {
    const next = zDatasetAccess.options.find((option) => option === value);
    if (next !== undefined) {
      form.setValue("access", next, { shouldDirty: true });
    }
  };

  const renderLicense = (option: DataLicense) => (
    <ChoiceOption
      key={option}
      value={option}
      id={`dataset-license-${option}`}
      label={t(`licenses.${LICENSE_KEYS[option]}`)}
      detail={t(`license.${LICENSE_KEYS[option]}Detail`)}
    >
      {option === "CC-BY-SA-4.0" && isShareAlike ? (
        <p
          className="text-status-stale-foreground mt-2 flex items-start gap-2 pl-7 text-xs leading-relaxed"
          data-testid="share-alike-warning"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("license.shareAlikeWarning")}
        </p>
      ) : null}
    </ChoiceOption>
  );

  const renderAccess = (option: DatasetAccess) => (
    <ChoiceOption
      key={option}
      value={option}
      id={`dataset-access-${option}`}
      label={t(`access.${option}`)}
      detail={t(`access.${option}Detail`)}
    >
      {option === "embargoed" && isEmbargoed ? <EmbargoDateField form={form} /> : null}
    </ChoiceOption>
  );

  return (
    <DatasetPublishStepFrame {...props}>
      <div className="space-y-6" data-testid="license-and-access">
        <SettingsCard
          title={t("license.title")}
          description={t("license.description")}
          contentClassName="space-y-4"
          data-testid="dataset-license"
        >
          <FormField
            control={form.control}
            name="license"
            render={({ field }) => (
              <FormItem>
                <RadioGroup
                  value={field.value}
                  onValueChange={handleLicenseChange}
                  className="space-y-2"
                >
                  {zDataLicense.options.map(renderLicense)}
                </RadioGroup>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
              <Lock className="text-primary size-4 shrink-0" aria-hidden />
              <span className="leading-tight">{t("license.permanentNote")}</span>
            </div>
            <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
              <Info className="text-primary size-4 shrink-0" aria-hidden />
              <span className="leading-tight">{t("license.metadataNote")}</span>
            </div>
          </div>

          <FormField
            control={form.control}
            name="rightToPublish"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1">
                  <FormLabel className="font-normal">{t("license.rightToPublish")}</FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </SettingsCard>

        <SettingsCard title={t("access.title")} description={t("access.description")}>
          <RadioGroup value={access} onValueChange={handleAccessChange} className="space-y-2">
            {zDatasetAccess.options.map(renderAccess)}
          </RadioGroup>
        </SettingsCard>
      </div>
    </DatasetPublishStepFrame>
  );
}
