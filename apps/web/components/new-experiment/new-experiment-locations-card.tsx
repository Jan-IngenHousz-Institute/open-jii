"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useMemo, useState, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import type { LocationPoint } from "@repo/ui/components/map";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";

import { useGeocodeLocationPoint } from "../../hooks/locations/useGeocodeLocationPoint";
import { useLocationSearch } from "../../hooks/locations/useLocationSearch";
import { useDebounce } from "../../hooks/useDebounce";
import { Map } from "../map";

interface NewExperimentLocationsCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentLocationsCard({ form }: NewExperimentLocationsCardProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const geocodeLocationPoint = useGeocodeLocationPoint();
  const [searchQuery, setSearchQuery] = useState("");

  // Watch locations from form
  const watchedLocations = form.watch("locations");
  const locations: LocationPoint[] = useMemo(() => watchedLocations ?? [], [watchedLocations]);

  // Handle locations change
  const handleLocationsChange = useCallback(
    (newLocations: LocationPoint[]) => {
      const locations = newLocations.map((location) => ({
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        country: location.country,
        region: location.region,
        municipality: location.municipality,
        postalCode: location.postalCode,
        addressLabel: location.address,
      }));

      form.setValue("locations", locations);
    },
    [form],
  );

  // Handle adding location from map click with geocoding
  const handleLocationAdd = useCallback(
    async (latitude: number, longitude: number): Promise<LocationPoint | void> => {
      const newLocation = await geocodeLocationPoint(latitude, longitude);
      if (newLocation) {
        handleLocationsChange([...(form.getValues("locations") ?? []), newLocation]);
      }
    },
    [form, handleLocationsChange, geocodeLocationPoint],
  );

  // Handle search
  const handleSearch = useCallback((query: string) => {
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

  return (
    <SettingsCard
      title={t("newExperiment.addLocationsTitle")}
      description={t("newExperiment.addLocationsDescription")}
      contentClassName="space-y-4"
    >
      <Map
        locations={locations}
        onLocationsChange={handleLocationsChange}
        onLocationAdd={handleLocationAdd}
        selectionMode={true}
        onSearch={handleSearch}
        searchResults={searchResults}
        searchLoading={searchLoading}
        center={[52.3676, 4.9041]} // Amsterdam as default center
        zoom={10}
        height="400px"
        showSidebar={true}
        showLocationSearch={true}
        showDistances={false}
        sidebarTitle={t("newExperiment.locationsListTitle")}
        // On a phone the panel covers the map it is a legend for, so the map
        // comes first and the list opens on demand.
        sidebarCollapsed={isMobile}
        useClustering={true}
        showZoomControl={true}
        showScale={true}
        className="rounded-lg border"
      />
    </SettingsCard>
  );
}
