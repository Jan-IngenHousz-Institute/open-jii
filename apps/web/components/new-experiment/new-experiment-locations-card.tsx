"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";
import type { LocationPoint } from "@repo/ui/components/map";

const EnhancedMap = dynamic(
  () => import("@repo/ui/components").then((mod) => ({ default: mod.EnhancedMap })),
  {
    ssr: false,
  },
);

interface NewExperimentLocationsCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentLocationsCard({ form }: NewExperimentLocationsCardProps) {
  const { t } = useTranslation();

  // Watch locations from form
  const watchedLocations = form.watch("locations");
  const locations: LocationPoint[] = useMemo(() => watchedLocations ?? [], [watchedLocations]);

  // Handle locations change
  const handleLocationsChange = (newLocations: LocationPoint[]) => {
    form.setValue("locations", newLocations);
  };

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.addLocationsTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.addLocationsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EnhancedMap
          locations={locations}
          onLocationsChange={handleLocationsChange}
          selectionMode={true}
          center={[52.3676, 4.9041]} // Amsterdam as default center
          zoom={10}
          height="400px"
          showSidebar={true}
          showLocationSearch={true}
          showDistances={false}
          sidebarTitle={t("newExperiment.locationsListTitle")}
          sidebarCollapsed={false}
          useClustering={true}
          showZoomControl={true}
          showScale={true}
          className="rounded-lg border"
        />
      </CardContent>
    </Card>
  );
}
