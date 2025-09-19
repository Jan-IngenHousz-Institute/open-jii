import { tsr } from "@/lib/tsr";

/**
 * Hook to reverse geocode coordinates to get place information
 * @param latitude The latitude
 * @param longitude The longitude
 * @param enabled Whether the query should be enabled
 * @returns Query result containing geocode results
 */
export const useLocationGeocode = (latitude: number, longitude: number, enabled = true) => {
  return tsr.experiments.geocodeLocation.useQuery({
    queryData: {
      query: {
        latitude,
        longitude,
      },
    },
    queryKey: ["location-geocode", latitude, longitude],
    enabled: enabled && !isNaN(latitude) && !isNaN(longitude),
  });
};
