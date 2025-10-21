"use client";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

interface LocationsSectionProps {
  formData: CreateExperimentBody;
  onEdit: () => void;
}

export function LocationsSection({ formData, onEdit }: LocationsSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {t("experiments.locationsTitle")}
          </CardTitle>
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground text-xs transition-colors"
          >
            {t("common.edit")}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
          {t("experiments.researchLocations")} ({formData.locations?.length ?? 0})
        </div>
        {formData.locations?.length ? (
          <div className="space-y-2">
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
      </CardContent>
    </Card>
  );
}
