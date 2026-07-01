import { z } from "zod";

export const zExperimentLocation = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .min(1, "ExperimentLocation name is required")
    .max(255, "ExperimentLocation name must be 255 characters or less"),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  country: z.string().optional(),
  region: z.string().optional(),
  municipality: z.string().optional(),
  postalCode: z.string().optional(),
  addressLabel: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentLocationInput = z.object({
  name: z
    .string()
    .min(1, "ExperimentLocation name is required")
    .max(255, "ExperimentLocation name must be 255 characters or less"),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  country: z.string().optional(),
  region: z.string().optional(),
  municipality: z.string().optional(),
  postalCode: z.string().optional(),
  addressLabel: z.string().optional(),
});

export const zExperimentLocationList = z.array(zExperimentLocation);

export const zExperimentPlaceSearchResult = z.object({
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  country: z.string().optional(),
  region: z.string().optional(),
  municipality: z.string().optional(),
  postalCode: z.string().optional(),
});

export const zExperimentPlaceSearchQuery = z.object({
  query: z.string().min(1, "Search query is required"),
  maxResults: z.coerce.number().min(1).max(50).optional().default(10),
});

export const zExperimentPlaceSearchResponse = z.array(zExperimentPlaceSearchResult);

export const zExperimentGeocodeQuery = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

export const zExperimentGeocodeResponse = z.array(zExperimentPlaceSearchResult);

export const zAddExperimentLocationsBody = z.object({
  locations: z.array(zExperimentLocationInput),
});

export const zUpdateExperimentLocationsBody = z.object({
  locations: z.array(zExperimentLocationInput),
});

export type AddExperimentLocationsBody = z.infer<typeof zAddExperimentLocationsBody>;
export type UpdateExperimentLocationsBody = z.infer<typeof zUpdateExperimentLocationsBody>;
export type ExperimentLocation = z.infer<typeof zExperimentLocation>;
export type ExperimentLocationInput = z.infer<typeof zExperimentLocationInput>;
export type ExperimentLocationList = z.infer<typeof zExperimentLocationList>;
export type ExperimentPlaceSearchResult = z.infer<typeof zExperimentPlaceSearchResult>;
export type ExperimentPlaceSearchQuery = z.infer<typeof zExperimentPlaceSearchQuery>;
export type ExperimentPlaceSearchResponse = z.infer<typeof zExperimentPlaceSearchResponse>;
export type ExperimentGeocodeQuery = z.infer<typeof zExperimentGeocodeQuery>;
export type ExperimentGeocodeResponse = z.infer<typeof zExperimentGeocodeResponse>;
