"use client";

import type { UseFormReturn } from "react-hook-form";

import type {
  ColumnDescription,
  ColumnTerm,
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

type TermName = "traitTerm" | "methodTerm" | "scaleTerm";

const LABEL_KEYS: Record<TermName, string> = {
  traitTerm: "describe.term.labelTrait",
  methodTerm: "describe.term.labelMethod",
  scaleTerm: "describe.term.labelScale",
};

interface ColumnTermFieldProps {
  form: UseFormReturn<ColumnDescription>;
  name: TermName;
  disabled: boolean;
}

/** The term for one field. Only the trait can be left as "No term fits", which counts as done. */
export function ColumnTermField({ form, name, disabled }: ColumnTermFieldProps) {
  const { t } = useTranslation("studyMetadata");
  const isTrait = name === "traitTerm";
  const isNoTermFits = form.watch("noTermFits") === true;

  const handleSelect = (term: ColumnTerm) => {
    form.setValue(name, term, { shouldDirty: true });
    form.setValue("noTermFits", false, { shouldDirty: true });
  };

  const handleClear = () => {
    form.setValue(name, null, { shouldDirty: true });
  };

  const handleNoTermFits = () => {
    form.setValue("traitTerm", null, { shouldDirty: true });
    form.setValue("noTermFits", true, { shouldDirty: true });
  };

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(LABEL_KEYS[name])}</FormLabel>
          <FormControl>
            <ColumnTermSelect
              value={field.value}
              isNoTermFits={isTrait ? isNoTermFits : undefined}
              disabled={disabled}
              onSelect={handleSelect}
              onClear={handleClear}
              onNoTermFits={isTrait ? handleNoTermFits : undefined}
            />
          </FormControl>
          <FormDescription>
            {isTrait ? t("describe.term.traitHelp") : t("describe.term.optionalHelp")}
          </FormDescription>
        </FormItem>
      )}
    />
  );
}
