"use client";

import { Plus } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { ContributorType, DatasetContributor } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { DatasetContributorRow } from "./dataset-contributor-row";
import type { PublishDatasetForm } from "./dataset-publish-schema";

/** Measurers who are not authors start here as data collectors, so their part is on record. */
export function DatasetContributorList({ form }: { form: UseFormReturn<PublishDatasetForm> }) {
  const { t } = useTranslation("datasets");
  const { fields, update, remove } = useFieldArray({
    control: form.control,
    name: "contributors",
  });

  const handleTypeChange = (position: number, contributorType: ContributorType) => {
    update(position, { ...form.getValues(`contributors.${position}`), contributorType });
  };

  const renderRow = (field: DatasetContributor & { id: string }, position: number) => (
    <DatasetContributorRow
      key={field.id}
      position={position}
      contributor={field}
      onTypeChange={handleTypeChange}
      onRemove={remove}
    />
  );

  return (
    <div className="space-y-3">
      <ul className="divide-border divide-y">{fields.map(renderRow)}</ul>
      <Button type="button" variant="outline" size="sm">
        <Plus className="size-4" />
        {t("describe.addContributor")}
      </Button>
    </div>
  );
}
