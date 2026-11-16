"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { RelationType } from "@repo/api/domains/experiment/study/experiment-study.schema";
import { zRelationType } from "@repo/api/domains/experiment/study/experiment-study.schema";
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
import { useRelationLabel } from "./use-relation-label";

interface StudyRelatedWorkFieldsProps {
  form: UseFormReturn<StudyDetailsFormValues>;
}

/** Papers, datasets and pages the study relates to, as DataCite's related identifiers. */
export function StudyRelatedWorkFields({ form }: StudyRelatedWorkFieldsProps) {
  const { t } = useTranslation("studyMetadata");
  const relationLabel = useRelationLabel();
  const relatedWork = useFieldArray({ control: form.control, name: "relatedWork" });
  const hasRelatedWork = relatedWork.fields.length > 0;

  const handleAdd = () => relatedWork.append({ identifier: "", relationType: "IsDescribedBy" });

  const toRelationType = (value: string) => zRelationType.safeParse(value).data ?? "IsDescribedBy";

  const renderRelation = (relation: RelationType) => (
    <SelectItem key={relation} value={relation}>
      {relationLabel(relation)}
    </SelectItem>
  );

  const renderRow = (row: { id: string }, index: number) => (
    <div key={row.id} className="flex items-start gap-2">
      <FormField
        control={form.control}
        name={`relatedWork.${index}.relationType`}
        render={({ field }) => (
          <FormItem className="w-40 shrink-0">
            <FormLabel>{t("relatedWork.relation")}</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => field.onChange(toRelationType(value))}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>{zRelationType.options.map(renderRelation)}</SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`relatedWork.${index}.identifier`}
        render={({ field }) => (
          <FormItem className="min-w-0 flex-1">
            <FormLabel>{t("relatedWork.identifier")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                className="font-mono"
                placeholder={t("relatedWork.identifierPlaceholder")}
              />
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
        aria-label={t("relatedWork.remove")}
        onClick={() => relatedWork.remove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <section aria-labelledby="study-details-related-work" className="space-y-3">
      <h3 id="study-details-related-work" className="text-sm font-medium">
        {t("relatedWork.title")}
      </h3>
      {hasRelatedWork ? (
        relatedWork.fields.map(renderRow)
      ) : (
        <p className="text-muted-foreground text-sm">{t("relatedWork.empty")}</p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        {hasRelatedWork ? t("relatedWork.addAnother") : t("relatedWork.add")}
      </Button>
      <p className="text-muted-foreground text-sm">{t("relatedWork.help")}</p>
    </section>
  );
}
