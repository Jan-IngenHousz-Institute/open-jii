import type { OrganizationType } from "@repo/api/domains/organization/organization.schema";

// Namespace-qualified: react-i18next pins `t` to the FIRST namespace of an
// array, so a bare `type.x` from a multi-namespace screen renders raw.
const TYPE_LABEL_KEYS = {
  research_institute: "organizations:type.research_institute",
  non_profit: "organizations:type.non_profit",
  private_company: "organizations:type.private_company",
  government_agency: "organizations:type.government_agency",
  university: "organizations:type.university",
} as const satisfies Record<OrganizationType, string>;

export function organizationTypeLabelKey(type: OrganizationType | null): string | null {
  return type ? TYPE_LABEL_KEYS[type] : null;
}
