"use client";

import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { ContributorType, DatasetContributor } from "@repo/api/domains/dataset/dataset.schema";

import { DatasetContributorRow } from "./dataset-contributor-row";
import type { PublishDatasetForm } from "./dataset-publish-schema";
import type { PersonRole } from "./use-dataset-people";

interface DatasetContributorListProps {
  form: UseFormReturn<PublishDatasetForm>;
  onRoleChange: (key: string, role: PersonRole) => void;
}

/** Each contributor with the DataCite type of their part, which the record states. */
export function DatasetContributorList({ form, onRoleChange }: DatasetContributorListProps) {
  const { fields, update } = useFieldArray({ control: form.control, name: "contributors" });

  const handleTypeChange = (position: number, contributorType: ContributorType) => {
    update(position, { ...form.getValues(`contributors.${position}`), contributorType });
  };

  const renderRow = (field: DatasetContributor & { id: string }, position: number) => (
    <DatasetContributorRow
      key={field.id}
      position={position}
      contributor={field}
      onTypeChange={handleTypeChange}
      onRoleChange={onRoleChange}
    />
  );

  return <ul className="divide-border divide-y">{fields.map(renderRow)}</ul>;
}
