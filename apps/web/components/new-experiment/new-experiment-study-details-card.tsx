import { DocsHelpLink } from "@/components/docs-help-link";
import type { UseFormReturn } from "react-hook-form";

import type {
  CreateExperimentBody,
  DataLicense,
} from "@repo/api/domains/experiment/experiment.schema";
import { zDataLicense } from "@repo/api/domains/experiment/experiment.schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";

interface NewExperimentStudyDetailsCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

const LICENSE_NONE = "none";

export function NewExperimentStudyDetailsCard({ form }: NewExperimentStudyDetailsCardProps) {
  const { t } = useTranslation();

  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  // The wizard's per-step schemas must stay plain objects, so this cross-field
  // check lives here; the create contract re-validates it server-side.
  const isEndBeforeStart = Boolean(startDate && endDate && endDate < startDate);

  const licenseLabels: Record<DataLicense, string> = {
    "CC0-1.0": t("newExperiment.licenseCc0"),
    "CC-BY-4.0": t("newExperiment.licenseCcBy"),
  };

  const handleOptionalChange =
    (onChange: (value: string | undefined) => void) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value || undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("newExperiment.studyDetailsTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.studyDetailsDescription")}</CardDescription>
        <DocsHelpLink path="/guide/sharing/open-fair-data" />
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("newExperiment.startDate")}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ""}
                    onChange={handleOptionalChange(field.onChange)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("newExperiment.endDate")}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ""}
                    onChange={handleOptionalChange(field.onChange)}
                  />
                </FormControl>
                {isEndBeforeStart ? (
                  <p className="text-destructive text-sm font-medium">
                    {t("newExperiment.endBeforeStart")}
                  </p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="organism"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.organism")}</FormLabel>
              <FormControl>
                <Input
                  value={field.value ?? ""}
                  onChange={handleOptionalChange(field.onChange)}
                  placeholder={t("newExperiment.organismPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="experimentalDesign"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.experimentalDesign")}</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ""}
                  onChange={handleOptionalChange(field.onChange)}
                  placeholder={t("newExperiment.experimentalDesignPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="growthFacility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.growthFacility")}</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ""}
                  onChange={handleOptionalChange(field.onChange)}
                  placeholder={t("newExperiment.growthFacilityPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="license"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.license")}</FormLabel>
              <Select
                value={field.value ?? LICENSE_NONE}
                onValueChange={(value) =>
                  field.onChange(value === LICENSE_NONE ? undefined : value)
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("newExperiment.licensePlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={LICENSE_NONE}>{t("newExperiment.licenseNone")}</SelectItem>
                  {zDataLicense.options.map((license) => (
                    <SelectItem key={license} value={license}>
                      {licenseLabels[license]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
