import { SettingsCard } from "@/components/shared/settings-card";
import { MapPinIcon } from "lucide-react";
import React from "react";

import type { ExperimentLocationList } from "@repo/api/domains/experiment/locations/experiment-locations.schema";
import { useTranslation } from "@repo/i18n";
import type { LocationPoint } from "@repo/ui/components/map";

import { Map } from "../map";

interface ExperimentLocationsDisplayProps {
  locations: ExperimentLocationList;
  isLoading?: boolean;
}

export function ExperimentLocationsDisplay({
  locations,
  isLoading = false,
}: ExperimentLocationsDisplayProps) {
  const { t } = useTranslation("experiments");

  if (isLoading) {
    return (
      <SettingsCard icon={MapPinIcon} title={t("details.locations.locationsTitle")}>
        <div className="animate-pulse space-y-2">
          <div className="bg-muted h-4 w-3/4 rounded"></div>
          <div className="bg-muted h-64 rounded"></div>
        </div>
      </SettingsCard>
    );
  }

  if (locations.length === 0) {
    return (
      <SettingsCard icon={MapPinIcon} title={t("details.locations.locationsTitle")}>
        <div className="py-8 text-center">
          <MapPinIcon className="text-muted-foreground mx-auto h-12 w-12" />
          <h3 className="text-foreground mt-2 text-sm font-medium">
            {t("details.locations.noLocations")}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("details.locations.noLocationsDescription")}
          </p>
        </div>
      </SettingsCard>
    );
  }

  // Convert API locations to LocationPoint format for the Map component
  const mapLocations: LocationPoint[] = locations.map((location) => ({
    id: location.id,
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    country: location.country,
    region: location.region,
    municipality: location.municipality,
    postalCode: location.postalCode,
    address: location.addressLabel,
  }));

  // Calculate center point for the map based on all locations
  const centerLatitude =
    mapLocations.reduce((sum, loc) => sum + loc.latitude, 0) / mapLocations.length;
  const centerLongitude =
    mapLocations.reduce((sum, loc) => sum + loc.longitude, 0) / mapLocations.length;

  return (
    <SettingsCard
      icon={MapPinIcon}
      title={t("details.locations.locationsTitle")}
      description={
        locations.length === 1
          ? t("details.locations.locationsCount", { count: locations.length })
          : t("details.locations.locationsCount_plural", { count: locations.length })
      }
      contentClassName="space-y-4"
    >
      {/* Map Display */}
      <div className="overflow-hidden rounded-lg border">
        <Map
          locations={mapLocations}
          selectionMode={false}
          height="400px"
          center={[centerLatitude, centerLongitude]}
          zoom={mapLocations.length === 1 ? 12 : 8}
          minZoom={2}
          maxZoom={18}
          showZoomControl={true}
          showScale={true}
          showSidebar={true}
          showLocationSearch={false}
          showDistances={false}
          sidebarTitle={t("details.locations.locationsTitle")}
          disabled={false}
          className="border-0"
        />
      </div>
    </SettingsCard>
  );
}
