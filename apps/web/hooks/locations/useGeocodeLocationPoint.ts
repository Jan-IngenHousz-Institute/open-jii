import { orpc } from "@/lib/orpc";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { LocationPoint } from "@repo/ui/components/map";

/**
 * Reverse geocodes a map click into a named location, or null when nothing is found there.
 */
export function useGeocodeLocationPoint() {
  const queryClient = useQueryClient();

  return useCallback(
    async (latitude: number, longitude: number): Promise<LocationPoint | null> => {
      const places = await queryClient.fetchQuery(
        orpc.experiments.geocodeLocation.queryOptions({
          input: { latitude, longitude },
          retry: 3,
        }),
      );
      const place = places.at(0);
      if (!place) return null;
      return {
        id: crypto.randomUUID(),
        name: place.label,
        latitude,
        longitude,
        country: place.country,
        region: place.region,
        municipality: place.municipality,
        postalCode: place.postalCode,
        address: place.label,
      };
    },
    [queryClient],
  );
}
