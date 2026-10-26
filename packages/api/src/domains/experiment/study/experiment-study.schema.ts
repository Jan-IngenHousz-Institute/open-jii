import { z } from "zod";

/** An NCBI Taxonomy entry, which MIAPPE recommends for the organism. */
export const zOrganism = z.object({
  taxonId: z.string().regex(/^\d+$/),
  name: z.string(),
  commonName: z.string().optional(),
});

export const zOrganismSearchQuery = z.object({
  query: z.string().trim().min(2).max(100),
});

export const zOrganismSearchResponse = z.object({
  organisms: z.array(zOrganism),
});

/** The CO_715 growth facility types MIAPPE asks for, beside the free-text description. */
export const zGrowthFacilityType = z.enum(["open_field", "greenhouse", "growth_chamber", "other"]);

export type Organism = z.infer<typeof zOrganism>;
export type OrganismSearchResponse = z.infer<typeof zOrganismSearchResponse>;
export type GrowthFacilityType = z.infer<typeof zGrowthFacilityType>;
