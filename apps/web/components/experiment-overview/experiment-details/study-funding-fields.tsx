"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { FunderIdentifierType } from "@repo/api/domains/experiment/experiment.schema";
import { zFunderIdentifierType } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { StudyDetailsFormValues } from "./study-details-form-schema";
import { EMPTY_FUNDING_REFERENCE } from "./study-details-form-schema";
import { useFunderIdentifierTypeLabel } from "./use-funder-identifier-type-label";

const NO_IDENTIFIER = "none";

interface StudyFundingFieldsProps {
  form: UseFormReturn<StudyDetailsFormValues>;
}

/** Funding references as DataCite keeps them: the funder, its identifier and the award. */
export function StudyFundingFields({ form }: StudyFundingFieldsProps) {
  const { t } = useTranslation("studyMetadata");
  const identifierTypeLabel = useFunderIdentifierTypeLabel();
  const funding = useFieldArray({ control: form.control, name: "fundingReferences" });
  const hasFunding = funding.fields.length > 0;

  const handleAdd = () => funding.append(EMPTY_FUNDING_REFERENCE);

  const handleOptionalChange =
    (onChange: (value: string | null) => void) => (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(event.target.value || null);

  const toIdentifierType = (value: string) => zFunderIdentifierType.safeParse(value).data ?? null;

  const renderIdentifierType = (type: FunderIdentifierType) => (
    <SelectItem key={type} value={type}>
      {identifierTypeLabel(type)}
    </SelectItem>
  );

  const renderReference = (row: { id: string }, index: number) => (
    <div key={row.id} className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <FormField
          control={form.control}
          name={`fundingReferences.${index}.funderName`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>{t("funding.funder")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("funding.funderPlaceholder")} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-[22px] shrink-0"
          aria-label={t("funding.remove")}
          onClick={() => funding.remove(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FormField
          control={form.control}
          name={`fundingReferences.${index}.funderIdentifierType`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("funding.identifierType")}</FormLabel>
              <Select
                value={field.value ?? NO_IDENTIFIER}
                onValueChange={(value) => field.onChange(toIdentifierType(value))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_IDENTIFIER}>{t("funding.identifierTypeNone")}</SelectItem>
                  {zFunderIdentifierType.options.map(renderIdentifierType)}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`fundingReferences.${index}.funderIdentifier`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("funding.identifier")}</FormLabel>
              <FormControl>
                <Input
                  value={field.value ?? ""}
                  onChange={handleOptionalChange(field.onChange)}
                  placeholder={t("funding.identifierPlaceholder")}
                  className="font-mono"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FormField
          control={form.control}
          name={`fundingReferences.${index}.awardNumber`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("funding.awardNumber")}</FormLabel>
              <FormControl>
                <Input
                  value={field.value ?? ""}
                  onChange={handleOptionalChange(field.onChange)}
                  placeholder={t("funding.awardNumberPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`fundingReferences.${index}.awardTitle`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("funding.awardTitle")}</FormLabel>
              <FormControl>
                <Input
                  value={field.value ?? ""}
                  onChange={handleOptionalChange(field.onChange)}
                  placeholder={t("funding.awardTitlePlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name={`fundingReferences.${index}.awardUri`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("funding.awardUri")}</FormLabel>
            <FormControl>
              <Input
                value={field.value ?? ""}
                onChange={handleOptionalChange(field.onChange)}
                placeholder={t("funding.awardUriPlaceholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  return (
    <section aria-labelledby="study-details-funding" className="space-y-3 border-t pt-4">
      <h3 id="study-details-funding" className="text-sm font-semibold">
        {t("funding.title")}
      </h3>
      <p className="text-muted-foreground text-sm">{t("funding.help")}</p>
      {hasFunding ? (
        funding.fields.map(renderReference)
      ) : (
        <p className="text-muted-foreground text-sm">{t("funding.empty")}</p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        {hasFunding ? t("funding.addAnother") : t("funding.add")}
      </Button>
    </section>
  );
}
