import { z } from "zod";

/** Mirrors the `organization_type` enum; organizations may leave it unset. */
export const zOrganizationType = z.enum([
  "research_institute",
  "non_profit",
  "private_company",
  "government_agency",
  "university",
  "demo",
]);
export type OrganizationType = z.infer<typeof zOrganizationType>;
