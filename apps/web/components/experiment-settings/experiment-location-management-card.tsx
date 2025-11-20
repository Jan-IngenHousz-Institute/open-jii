"use client";

import { MapPinIcon } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";

import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";
import type { LocationPoint } from "@repo/ui/components/map";
import { toast } from "@repo/ui/hooks";

import { useExperimentLocations } from "../../hooks/experiment/useExperimentLocations/useExperimentLocations";
import { useExperimentLocationsUpdate } from "../../hooks/experiment/useExperimentLocationsUpdate/useExperimentLocationsUpdate";
import { useLocationGeocode } from "../../hooks/locations/useLocationGeocode";
import { useLocationSearch } from "../../hooks/locations/useLocationSearch";
import { useDebounce } from "../../hooks/useDebounce";
import { Map } from "../map";

interface ExperimentLocationManagementProps {
  experimentId: string;
  hasAccess?: boolean;
  isArchived?: boolean;
}

export function ExperimentLocationManagement({
  experimentId,
  hasAccess = false,
  isArchived = false,
}: ExperimentLocationManagementProps) {
  const { t } = useTranslation("experiments");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);

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
        country: location.country,
        region: location.region,
        municipality: location.municipality,
        postalCode: location.postalCode,
        address: location.addressLabel,
      })),
    [locations],
  );

  const [editedLocations, setEditedLocations] = useState<LocationPoint[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Geocoding hook for when locations are added via map click
  const { data: geocodeData, isLoading: geocodeLoading } = useLocationGeocode(
    pendingLocation?.lat ?? 0,
    pendingLocation?.lng ?? 0,
    !!pendingLocation,
  );

  // Sync editedLocations with API locations when data loads
  useEffect(() => {
    setEditedLocations(mapLocations);
  }, [mapLocations]);

  // Handle search
  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Debounce the search query
  const [debouncedSearchQuery] = useDebounce(searchQuery, 2_000);

  // Use the location search hook with debounced query
  const { data: searchData, isLoading: searchLoading } = useLocationSearch(
    debouncedSearchQuery,
    10, // maxResults
    debouncedSearchQuery.length >= 3,
  );

  const searchResults = searchData?.body ?? [];

  const saveLocations = useCallback(
    async (locationsToUpdate: LocationPoint[]) => {
      setIsSaving(true);
      try {
        const locationsToSave = locationsToUpdate.map((location) => ({
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          country: location.country,
          region: location.region,
          municipality: location.municipality,
          postalCode: location.postalCode,
          addressLabel: location.address,
        }));

        await updateLocationsMutation.mutateAsync({
          params: { id: experimentId },
          body: { locations: locationsToSave },
        });
        toast({ description: t("experiments.experimentUpdated") });
      } finally {
        setIsSaving(false);
      }
    },
    [experimentId, updateLocationsMutation, t],
  );

  const handleLocationsChange = async (newLocations: LocationPoint[]) => {
    setEditedLocations(newLocations);
    // Auto-save whenever locations change
    await saveLocations(newLocations);
  };

  // Handle adding location from map click with geocoding
  const handleLocationAdd = React.useCallback(
    (latitude: number, longitude: number): Promise<LocationPoint | void> => {
      // Set pending location to trigger geocoding
      setPendingLocation({ lat: latitude, lng: longitude });

      // Return a promise that will resolve when geocoding is complete
      return Promise.resolve();
    },
    [],
  );

  // Effect to handle geocoded location data
  useEffect(() => {
    if (geocodeData?.body && pendingLocation) {
      const geocodeResults = geocodeData.body;
      // Use the first result if available, or create a basic location
      const firstResult = geocodeResults[0];

      const newLocation: LocationPoint = {
        id: Date.now().toString(),
        name: firstResult.label,
        latitude: pendingLocation.lat,
        longitude: pendingLocation.lng,
        country: firstResult.country,
        region: firstResult.region,
        municipality: firstResult.municipality,
        postalCode: firstResult.postalCode,
        address: firstResult.label,
      };

      const updatedLocations = [...editedLocations, newLocation];
      setEditedLocations(updatedLocations);

      // Auto-save the new location
      void saveLocations(updatedLocations);

      // Clear pending location
      setPendingLocation(null);
    }
  }, [geocodeData, pendingLocation, geocodeLoading, editedLocations, saveLocations]);

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
          {/* Interactive Map for Editing */}

          <div className="min-h-[400px] rounded border">
            <Map
              locations={editedLocations}
              onLocationsChange={handleLocationsChange}
              onLocationAdd={handleLocationAdd}
              selectionMode={hasAccess && !isArchived}
              onSearch={handleSearch}
              searchResults={searchResults}
              searchLoading={searchLoading}
              disabled={!hasAccess || isSaving || isArchived}
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
              showLocationSearch={true}
              showDistances={false}
              sidebarTitle={t("settings.locations.editMode")}
            />
          </div>

          <div className="flex items-center justify-between">
            {editedLocations.length > 0 && (
              <div className="text-sm text-gray-600">
                {t("settings.locations.editingCount", { count: editedLocations.length })}
              </div>
            )}
            {isSaving && <div className="text-sm text-gray-500">{t("common.saving")}...</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
