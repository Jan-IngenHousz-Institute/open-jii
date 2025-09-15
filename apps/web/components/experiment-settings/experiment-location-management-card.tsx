"use client";

import { MapPinIcon } from "lucide-react";
import dynamic from "next/dynamic";
import React, { useState, useEffect, useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@repo/ui/components";
import type { LocationPoint } from "@repo/ui/components/map";

import { useExperimentLocations } from "../../hooks/experiment/useExperimentLocations/useExperimentLocations";
import { useExperimentLocationsUpdate } from "../../hooks/experiment/useExperimentLocationsUpdate/useExperimentLocationsUpdate";

const Map = dynamic(() => import("@repo/ui/components/map"), { ssr: false });

interface ExperimentLocationManagementProps {
  experimentId: string;
}

export function ExperimentLocationManagement({ experimentId }: ExperimentLocationManagementProps) {
  const { t } = useTranslation("experiments");

  const { data: locationsData, isLoading } = useExperimentLocations(experimentId);
  const updateLocationsMutation = useExperimentLocationsUpdate();

  // Get experiment locations from API response
  const locations = useMemo(() => locationsData?.body ?? [], [locationsData]);

  const mapLocations: LocationPoint[] = useMemo(
    () =>
      locations.map((location) => ({
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
      })),
    [locations],
  );

  const [editedLocations, setEditedLocations] = useState<LocationPoint[]>([]);

  // Sync editedLocations with API locations when data loads
  useEffect(() => {
    setEditedLocations(mapLocations);
  }, [mapLocations]);

  const handleSave = async () => {
    const locationsToSave = editedLocations.map((location) => ({
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    }));

    await updateLocationsMutation.mutateAsync({
      params: { id: experimentId },
      body: { locations: locationsToSave },
    });
  };

  const handleCancel = () => {
    setEditedLocations([...mapLocations]);
  };

  const handleLocationsChange = (newLocations: LocationPoint[]) => {
    setEditedLocations(newLocations);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            {t("settings.locations.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/4 rounded bg-gray-200"></div>
            <div className="h-32 rounded bg-gray-200"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            {t("settings.locations.title")}
          </CardTitle>
          <CardDescription>{t("settings.locations.description")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Edit Mode */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{t("settings.locations.editMode")}</h4>
              <p className="text-sm text-gray-500">{t("settings.locations.editModeDescription")}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={updateLocationsMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateLocationsMutation.isPending}>
                {updateLocationsMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>

          {/* Interactive Map for Editing */}
          <div className="rounded border">
            <Map
              locations={editedLocations}
              onLocationsChange={handleLocationsChange}
              selectionMode={true}
              height="400px"
              center={
                editedLocations.length > 0
                  ? [
                      editedLocations.reduce((sum, loc) => sum + loc.latitude, 0) /
                        editedLocations.length,
                      editedLocations.reduce((sum, loc) => sum + loc.longitude, 0) /
                        editedLocations.length,
                    ]
                  : [52.52, 13.405] // Default to Berlin
              }
              zoom={editedLocations.length === 1 ? 12 : 8}
              minZoom={2}
              maxZoom={18}
              showZoomControl={true}
              showScale={true}
              showSidebar={true}
              sidebarTitle={t("settings.locations.editMode")}
            />
          </div>

          {editedLocations.length > 0 && (
            <div className="text-sm text-gray-600">
              {editedLocations.length === 1
                ? t("settings.locations.editingCount", {
                    count: editedLocations.length,
                  })
                : t("settings.locations.editingCount_plural", {
                    count: editedLocations.length,
                  })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
