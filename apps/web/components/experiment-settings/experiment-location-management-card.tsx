"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import type { LocationPoint } from "@repo/ui/components/map";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentLocations } from "../../hooks/experiment/useExperimentLocations/useExperimentLocations";
import { useExperimentLocationsUpdate } from "../../hooks/experiment/useExperimentLocationsUpdate/useExperimentLocationsUpdate";
import { useGeocodeLocationPoint } from "../../hooks/locations/useGeocodeLocationPoint";
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

  const { data: locationsData, isLoading } = useExperimentLocations(experimentId);
  const updateLocationsMutation = useExperimentLocationsUpdate();

  // Get experiment locations from API response
  const locations = useMemo(() => locationsData ?? [], [locationsData]);

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

  const [editedLocations, setEditedLocations] = useState<LocationPoint[]>(mapLocations);
  const [syncedLocations, setSyncedLocations] = useState(mapLocations);
  const [isSaving, setIsSaving] = useState(false);

  // Sync editedLocations with API locations when data loads
  if (syncedLocations !== mapLocations) {
    setSyncedLocations(mapLocations);
    setEditedLocations(mapLocations);
  }

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

  const searchResults = searchData ?? [];

  const saveLocations = useCallback(
    (locationsToUpdate: LocationPoint[]) => {
      setIsSaving(true);
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

      updateLocationsMutation.mutate(
        {
          id: experimentId,
          locations: locationsToSave,
        },
        {
          onSuccess: () => {
            toast({ description: t("experiments.experimentUpdated") });
          },
          onError: (error) => {
            toast({ description: parseApiError(error)?.message, variant: "destructive" });
          },
          onSettled: () => {
            setIsSaving(false);
          },
        },
      );
    },
    [experimentId, updateLocationsMutation, t],
  );

  // A geocode resolves after the click, so it appends to the list as it is then, not as it
  // was when the map captured it; edits made meanwhile survive.
  const latestLocationsRef = useRef(editedLocations);
  useEffect(() => {
    latestLocationsRef.current = editedLocations;
  }, [editedLocations]);

  const handleLocationsChange = useCallback(
    (newLocations: LocationPoint[]) => {
      latestLocationsRef.current = newLocations;
      setEditedLocations(newLocations);
      saveLocations(newLocations);
    },
    [saveLocations],
  );

  const geocodeLocationPoint = useGeocodeLocationPoint();

  const handleLocationAdd = useCallback(
    async (latitude: number, longitude: number): Promise<void> => {
      const newLocation = await geocodeLocationPoint(latitude, longitude);
      if (newLocation) handleLocationsChange([...latestLocationsRef.current, newLocation]);
    },
    [geocodeLocationPoint, handleLocationsChange],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-2">
          <div className="bg-muted h-[460px] rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interactive Map for Editing */}
      <div className="min-h-[460px]">
        <Map
          locations={editedLocations}
          onLocationsChange={handleLocationsChange}
          onLocationAdd={handleLocationAdd}
          selectionMode={hasAccess && !isArchived}
          onSearch={handleSearch}
          searchResults={searchResults}
          searchLoading={searchLoading}
          disabled={!hasAccess || isSaving || isArchived}
          height="460px"
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
          <div className="text-muted-foreground text-sm">
            {t("settings.locations.editingCount", { count: editedLocations.length })}
          </div>
        )}
        {isSaving && (
          <div className="text-muted-foreground text-sm">{t("experimentSettings.saving")}</div>
        )}
      </div>
    </div>
  );
}
