import { and } from "drizzle-orm";

import { db } from "../../src/database";
import { ensurePersonalOrganization } from "../../src/organizations";
import { upsertGrant } from "../../src/resource-grants";
import { users, profiles, experiments } from "../../src/schema";
import { CONTRIBUTOR_SEEDS } from "./constants";
import type { SeedExperiment } from "./types";

/** The people the silver pipeline already names on those rows, so a lookup by id resolves. */
export async function seedContributors(createdExperiments: SeedExperiment[]) {
  // 5b. Seed contributor users and link them to the Databricks-backed
  // experiments. The names/emails are placeholders; bars in the bar chart
  // still label by the name embedded in each row's contributor struct.
  await db.insert(users).values(
    CONTRIBUTOR_SEEDS.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      emailVerified: true,
      registered: true,
    })),
  );
  await db.insert(profiles).values(
    CONTRIBUTOR_SEEDS.map((c) => ({
      userId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      activated: true,
    })),
  );
  // Contributors hold the read-and-contribute tier: they can open their experiment
  // and add measurements to it, which is exactly what these seeds represent.
  for (const c of CONTRIBUTOR_SEEDS) {
    await upsertGrant(db, {
      resourceType: "experiment",
      resourceId: c.experimentId,
      granteeType: "user",
      granteeId: c.id,
      role: "viewer",
      createdBy: c.id,
    });
  }
  // Provision each contributor's personal organization (Phase 1 org provisioning).
  for (const c of CONTRIBUTOR_SEEDS) {
    await ensurePersonalOrganization(db, { id: c.id, name: c.name });
  }
  console.log(`  Created ${CONTRIBUTOR_SEEDS.length} contributor users + grants`);
}
