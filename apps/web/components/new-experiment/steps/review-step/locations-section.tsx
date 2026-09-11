"use client";

import { SettingsCard } from "@/components/shared/settings-card";

import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { cva } from "@repo/ui/lib/utils";

interface LocationsSectionProps {
  formData: CreateExperimentBody;
  onEdit: () => void;
}

const locationsList = cva("space-y-2", {
  variants: {
    scrollable: {
      true: "max-h-64 overflow-y-auto pr-2",
      false: "",
    },
  },
  defaultVariants: {
    scrollable: false,
  },
});

export function LocationsSection({ formData, onEdit }: LocationsSectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsCard
      title={t("experiments.locationsTitle")}
      action={
        <Button type="button" onClick={onEdit} variant="link" size="sm">
          {t("common.edit")}
        </Button>
      }
    >
      <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
        {t("experiments.researchLocations")} ({formData.locations?.length ?? 0})
      </div>
      {formData.locations?.length ? (
        <div className={locationsList({ scrollable: formData.locations.length >= 3 })}>
          {formData.locations.map((loc, i) => (
            <div key={i} className="rounded-md border px-3 py-2 text-sm font-medium">
              {loc.name}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm italic">
          {t("experiments.noLocationsAdded")}
        </div>
      )}
    </SettingsCard>
  );
}
