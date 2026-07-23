import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to reverse geocode coordinates to get place information
 * @param latitude The latitude
 * @param longitude The longitude
 * @param enabled Whether the query should be enabled
 * @returns Query result containing geocode results
 */
export const useLocationGeocode = (latitude: number, longitude: number, enabled = true) => {
  return useQuery(
    orpc.experiments.geocodeLocation.queryOptions({
      input: { latitude, longitude },
      enabled: enabled && !isNaN(latitude) && !isNaN(longitude),
    }),
  );
};
