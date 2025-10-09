import { MapPinIcon } from "lucide-react";
import React from "react";

import type { LocationList } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";
import type { LocationPoint } from "@repo/ui/components/map";

import { Map } from "../map";

interface ExperimentLocationsDisplayProps {
  locations: LocationList;
  isLoading?: boolean;
}

export function ExperimentLocationsDisplay({
  locations,
  isLoading = false,
}: ExperimentLocationsDisplayProps) {
  const { t } = useTranslation("experiments");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            {t("details.locations.locationsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/4 rounded bg-gray-200"></div>
            <div className="h-64 rounded bg-gray-200"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (locations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            {t("details.locations.locationsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <MapPinIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {t("details.locations.noLocations")}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {t("details.locations.noLocationsDescription")}
            </p>
          </div>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPinIcon className="h-5 w-5" />
              {t("details.locations.locationsTitle")}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {locations.length === 1
                ? t("details.locations.locationsCount", { count: locations.length })
                : t("details.locations.locationsCount_plural", { count: locations.length })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
