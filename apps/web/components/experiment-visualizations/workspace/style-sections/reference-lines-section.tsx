"use client";

import { Plus } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { ChartFormValues } from "../../charts/chart-config";
import type { ReferenceLine } from "../../charts/chart-options";
import { ReferenceLineRow } from "./reference-line-row";
import { CollapsibleStyleSection } from "./shared/collapsible-style-section";

interface ReferenceLinesSectionProps {
  form: UseFormReturn<ChartFormValues>;
  flat?: boolean;
}

const DEFAULT_COLOR = "#9ca3af";

/**
 * Style controls for static reference lines: axis-aligned threshold /
 * baseline / target markers drawn on top of cartesian charts.
 */
export function ReferenceLinesSection({ form, flat = false }: ReferenceLinesSectionProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Watched and set, not `useFieldArray`: that writes `[]` into an absent array on
  // mount, which autosave reads as an edit.
  const referenceLines = useWatch({ control: form.control, name: "config.referenceLines" }) ?? [];

  const setReferenceLines = (next: ReferenceLine[]) => {
    form.setValue("config.referenceLines", next, { shouldDirty: true });
  };

  const handleAdd = () => {
    setReferenceLines([
      ...referenceLines,
      { axis: "y", value: 0, label: "", color: DEFAULT_COLOR, dash: "dash" },
    ]);
  };

  const handleRemove = (index: number) => {
    setReferenceLines(referenceLines.filter((_, i) => i !== index));
  };

  return (
    <CollapsibleStyleSection title={t("workspace.style.referenceLines")} flat={flat}>
      {referenceLines.length === 0 && (
        <p className="text-muted-foreground text-xs">{t("workspace.style.referenceLinesEmpty")}</p>
      )}

      {referenceLines.map((_, index) => (
        // Rows bind by index, so an index key keeps each row on its own form path.
        <ReferenceLineRow
          key={index}
          form={form}
          index={index}
          onRemove={() => handleRemove(index)}
        />
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleAdd}>
        <Plus className="mr-1 h-3 w-3" />
        {t("workspace.style.referenceLineAdd")}
      </Button>
    </CollapsibleStyleSection>
  );
}
