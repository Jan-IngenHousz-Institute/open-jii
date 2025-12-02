"use client";

import { useMemo, useState } from "react";

import type { Location } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";
import type { LocationPoint } from "@repo/ui/components/map";

import { ExperimentLocationManagement } from "../../experiment-settings/experiment-location-management-card";
import { Map } from "../../map";

interface ExperimentLocationsSectionProps {
  experimentId: string;
  locations: Location[];
  hasAccess?: boolean;
  isArchived?: boolean;
}

const LOCATIONS_DISPLAYED = 2;

export function ExperimentLocationsSection({
  experimentId,
  locations,
  hasAccess = false,
  isArchived = false,
}: ExperimentLocationsSectionProps) {
  const { t } = useTranslation("experiments");
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

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

  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{t("details.location.locationsTitle")}</h4>
          <Button
            variant="ghost"
            className="text-primary h-auto p-0 hover:bg-transparent"
            onClick={() => setIsLocationDialogOpen(true)}
          >
            {hasAccess && !isArchived ? "Manage" : "View"}
          </Button>
        </div>
        <div className="text-muted-foreground">
          {locations.length > 0 ? (
            <>
              {locations.slice(0, LOCATIONS_DISPLAYED).map((location) => (
                <p key={location.id} className="truncate">
                  {location.name}
                </p>
              ))}

              {locations.length > LOCATIONS_DISPLAYED && (
                <p className="truncate text-sm italic">
                  {t("and")} {locations.length - LOCATIONS_DISPLAYED}{" "}
                  {t("details.location.otherLocations")}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm italic">
              {t("details.location.noLocationsAdded")}
            </p>
          )}
        </div>
        {locations.length > 0 && (
          <div className="relative mt-3 h-[140px] w-full overflow-hidden rounded-md">
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => setIsLocationDialogOpen(true)}
            />

            <Map
              locations={mapLocations}
              selectionMode={false}
              height="140px"
              showZoomControl={false}
              showScale={false}
              showSidebar={false}
              showLocationSearch={false}
              showDistances={false}
            />
          </div>
        )}
      </div>

      {/* Location Management Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("settings.locations.title")}</DialogTitle>
            <DialogDescription>{t("settings.locations.description")}</DialogDescription>
          </DialogHeader>
          <ExperimentLocationManagement
            experimentId={experimentId}
            hasAccess={hasAccess}
            isArchived={isArchived}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
