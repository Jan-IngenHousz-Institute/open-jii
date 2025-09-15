import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { experimentLocations } from "@repo/database";

// Create schemas for database operations
export const createLocationSchema = createInsertSchema(experimentLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectLocationSchema = createSelectSchema(experimentLocations);

// Define input type with numbers for API
export interface CreateLocationDto {
  experimentId: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Define output type from database
export type LocationDto = typeof selectLocationSchema._type;
