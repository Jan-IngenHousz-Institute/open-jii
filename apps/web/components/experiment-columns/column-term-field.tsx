"use client";

import type { UseFormReturn } from "react-hook-form";

import type {
  ColumnTerm,
  DescribeColumnBody,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@repo/ui/components/form";

import { ColumnTermSelect } from "./column-term-select";

type TermName = "propertyTerm" | "objectOfInterestTerm" | "contextTerm";

const LABEL_KEYS: Record<TermName, string> = {
  propertyTerm: "describe.term.labelProperty",
  objectOfInterestTerm: "describe.term.labelObjectOfInterest",
  contextTerm: "describe.term.labelContext",
};

interface ColumnTermFieldProps {
  form: UseFormReturn<DescribeColumnBody>;
  name: TermName;
  disabled: boolean;
}

/** The term for one part. Only the property can be left as "No term fits", which counts as done. */
export function ColumnTermField({ form, name, disabled }: ColumnTermFieldProps) {
  const { t } = useTranslation("studyMetadata");
  const isProperty = name === "propertyTerm";
  const isNoTermFits = form.watch("noTermFits") === true;

  const handleSelect = (term: ColumnTerm) => {
    form.setValue(name, term, { shouldDirty: true });
    if (isProperty) {
      form.setValue("noTermFits", false, { shouldDirty: true });
    }
  };

  const handleClear = () => {
    form.setValue(name, null, { shouldDirty: true });
  };

  const handleNoTermFits = () => {
    form.setValue("propertyTerm", null, { shouldDirty: true });
    form.setValue("noTermFits", true, { shouldDirty: true });
  };

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("describe.term.label")}</FormLabel>
          <FormControl>
            <ColumnTermSelect
              label={t(LABEL_KEYS[name])}
              value={field.value}
              isNoTermFits={isProperty ? isNoTermFits : undefined}
              disabled={disabled}
              onSelect={handleSelect}
              onClear={handleClear}
              onNoTermFits={isProperty ? handleNoTermFits : undefined}
            />
          </FormControl>
          {isProperty && <FormDescription>{t("describe.term.propertyHelp")}</FormDescription>}
        </FormItem>
      )}
    />
  );
}
