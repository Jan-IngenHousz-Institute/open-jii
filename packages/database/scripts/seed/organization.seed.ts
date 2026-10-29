import { db } from "../../src/postgres/database";
import { organizationMembers, organizations } from "../../src/postgres/schema";
import { CONTRIBUTOR_SEEDS, FIXTURE_ORG_SLUG_PREFIX } from "./constants";

type OrganizationType = NonNullable<typeof organizations.$inferInsert.type>;

const FIXTURE_ORGANIZATIONS: {
  slug: string;
  name: string;
  type: OrganizationType | null;
  description: string;
  location: string;
}[] = [
  {
    slug: "leaf-physiology-institute",
    name: "[Seed] Leaf Physiology Institute",
    type: "research_institute",
    description: "Photosynthesis and stomatal conductance under field conditions.",
    location: "Wageningen, Netherlands",
  },
  {
    slug: "open-plant-science-foundation",
    name: "[Seed] Open Plant Science Foundation",
    type: "non_profit",
    description: "Funds open hardware and open data for plant phenotyping.",
    location: "Ghent, Belgium",
  },
  {
    slug: "fieldsense-instruments",
    name: "[Seed] FieldSense Instruments",
    type: "private_company",
    description: "Builds handheld sensors for crop monitoring.",
    location: "Munich, Germany",
  },
  {
    slug: "national-crop-monitoring-agency",
    name: "[Seed] National Crop Monitoring Agency",
    type: "government_agency",
    description: "Tracks national crop health across growing seasons.",
    location: "Ottawa, Canada",
  },
  {
    slug: "northfield-university",
    name: "[Seed] Northfield University",
    type: "university",
    description: "Plant biology department running student field trials.",
    location: "East Lansing, United States",
  },
  {
    slug: "community-seed-library",
    name: "[Seed] Community Seed Library",
    type: null,
    description: "Volunteers sharing heirloom seeds and growing notes.",
    location: "Bristol, United Kingdom",
  },
];

export const FIXTURE_ORG_SLUGS = FIXTURE_ORGANIZATIONS.map(
  (fixture) => `${FIXTURE_ORG_SLUG_PREFIX}${fixture.slug}`,
);

/**
 * Public organizations of every type, so a fresh directory has rows to filter.
 * Also creates an untyped organization and owner memberships for existing contributor
 * users. Existing fixture slugs must be cleared before rerunning.
 * Database errors propagate; completed inserts are not rolled back on failure.
 */
export async function seedOrganizations() {
  for (const [index, fixture] of FIXTURE_ORGANIZATIONS.entries()) {
    const [organization] = await db
      .insert(organizations)
      .values({
        name: fixture.name,
        slug: FIXTURE_ORG_SLUGS[index],
        visibility: "public",
        type: fixture.type,
        description: fixture.description,
        location: fixture.location,
      })
      .returning({ id: organizations.id });
    const owner = CONTRIBUTOR_SEEDS[index % CONTRIBUTOR_SEEDS.length];
    await db
      .insert(organizationMembers)
      .values({ organizationId: organization.id, userId: owner.id, role: "owner" });
  }
  console.log(`  Created ${FIXTURE_ORGANIZATIONS.length} directory organizations`);
}
