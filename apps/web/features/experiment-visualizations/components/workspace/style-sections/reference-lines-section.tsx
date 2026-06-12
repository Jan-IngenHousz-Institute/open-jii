"use client";

import { Plus } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";

import type { ChartFormValues } from "../../charts/chart-config";
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    // The form's `config` is `Record<string, unknown>` at the top level so
    // RHF can't infer this path's element type. Cast at the seam.
    name: "config.referenceLines" as never,
  });

  return (
    <>
      <CollapsibleStyleSection title={t("workspace.style.referenceLines")} flat={flat}>
        {fields.length === 0 && (
          <p className="text-muted-foreground text-xs">
            {t("workspace.style.referenceLinesEmpty")}
          </p>
        )}

        {fields.map((field, index) => (
          <ReferenceLineRow
            key={field.id}
            form={form}
            index={index}
            onRemove={() => remove(index)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            append({
              axis: "y",
              value: 0,
              label: "",
              color: DEFAULT_COLOR,
              dash: "dash",
            })
          }
        >
          <Plus className="mr-1 h-3 w-3" />
          {t("workspace.style.referenceLineAdd")}
        </Button>
      </CollapsibleStyleSection>
      <Separator />
    </>
  );
}
