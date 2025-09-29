"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";
import type { LocationPoint } from "@repo/ui/components/map";

import { useLocationGeocode } from "../../hooks/locations/useLocationGeocode";
import { useLocationSearch } from "../../hooks/locations/useLocationSearch";
import { useDebounce } from "../../hooks/useDebounce";
import { Map } from "../map";

interface NewExperimentLocationsCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentLocationsCard({ form }: NewExperimentLocationsCardProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Watch locations from form
  const watchedLocations = form.watch("locations");
  const locations: LocationPoint[] = useMemo(() => watchedLocations ?? [], [watchedLocations]);

  // Geocoding hook for when locations are added via map click
  const { data: geocodeData, isLoading: geocodeLoading } = useLocationGeocode(
    pendingLocation?.lat ?? 0,
    pendingLocation?.lng ?? 0,
    !!pendingLocation,
  );

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

      const updatedLocations = [...locations, newLocation];
      handleLocationsChange(updatedLocations);

      // Clear pending location
      setPendingLocation(null);
    }
  }, [geocodeData, pendingLocation, geocodeLoading, locations, handleLocationsChange]);

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

  const searchResults = searchData?.body ?? [];

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.addLocationsTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.addLocationsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
