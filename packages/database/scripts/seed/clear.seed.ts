import { and, eq, inArray, like, or } from "drizzle-orm";

import { db } from "../../src/database";
import { personalOrgSlug } from "../../src/organizations";
import {
  users,
  profiles,
  protocols,
  macros,
  protocolMacros,
  experiments,
  experimentMembers,
  experimentDevices,
  flows,
  calibrationDefinitions,
  calibrationRuns,
  deviceGroups,
  iotDevices,
  organizations,
  resourceGrants,
  workbooks,
} from "../../src/schema";
import { SEED_EMAIL, SEED_PREFIX, SEED_EXPERIMENT_IDS, CONTRIBUTOR_SEEDS } from "./constants";

export async function clearSeedData() {
  // User + profile (seed user)
  const seedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, SEED_EMAIL));

  // Contributor users keyed by fixed UUIDs. We can't filter by email
  // pattern since the silver pipeline picks the contributor UUIDs, not us.
  const contributorIds = CONTRIBUTOR_SEEDS.map((c) => c.id);

  // Personal organizations provisioned for those seed users (Phase 1 org
  // provisioning). Everything created inside one goes with it, whatever it was named.
  const seedUserIds = [...seedUsers.map((u) => u.id), ...contributorIds];
  const seedOrganizations = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(inArray(organizations.slug, seedUserIds.map(personalOrgSlug)));
  const seedOrganizationIds = seedOrganizations.map((organization) => organization.id);

  // Find seed experiment IDs for join table cleanup
  const seedExperiments = await db
    .select({ id: experiments.id })
    .from(experiments)
    .where(
      or(
        like(experiments.name, SEED_PREFIX),
        inArray(experiments.id, SEED_EXPERIMENT_IDS),
        ...(seedOrganizationIds.length > 0
          ? [inArray(experiments.organizationId, seedOrganizationIds)]
          : []),
      ),
    );
  const seedExpIds = seedExperiments.map((e) => e.id);

  if (seedExpIds.length > 0) {
    // experiment_members is dormant, but its rows still have an FK to experiments
    // with no cascade, so any legacy rows must go before the experiments do.
    await db.delete(experimentMembers).where(inArray(experimentMembers.experimentId, seedExpIds));
    // Mirrored member grants are polymorphic (no FK), so no cascade either
    await db
      .delete(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          inArray(resourceGrants.resourceId, seedExpIds),
        ),
      );
    // Experiments cascade-delete: flows, experimentDevices
    await db.delete(experiments).where(inArray(experiments.id, seedExpIds));
  }

  // Calibration runs RESTRICT their definition, so runs go first; a run's
  // device_calibrations rows cascade with it.
  const seedDefinitions = await db
    .select({ id: calibrationDefinitions.id })
    .from(calibrationDefinitions)
    .where(like(calibrationDefinitions.name, SEED_PREFIX));
  const seedDefinitionIds = seedDefinitions.map((definition) => definition.id);
  if (seedDefinitionIds.length > 0) {
    await db
      .delete(calibrationRuns)
      .where(inArray(calibrationRuns.definitionId, seedDefinitionIds));
    await db
      .delete(calibrationDefinitions)
      .where(inArray(calibrationDefinitions.id, seedDefinitionIds));
  }

  // Groups cascade-delete their memberships.
  await db.delete(deviceGroups).where(like(deviceGroups.name, "[Seed]%"));

  // Devices before organizations: iot_devices references its org with RESTRICT.
  // Deleting a device cascade-removes its remaining experiment bindings.
  await db.delete(iotDevices).where(like(iotDevices.thingName, "seed-%"));

  // Workbooks cascade-delete their versions; experiments pointing at them are
  // already gone (or get workbook_version_id set null).
  await db.delete(workbooks).where(like(workbooks.name, SEED_PREFIX));

  // Protocols cascade-delete protocolMacros
  await db.delete(protocols).where(like(protocols.name, SEED_PREFIX));
  await db.delete(macros).where(like(macros.name, SEED_PREFIX));

  // Deleting an organization cascade-removes its organization_members.
  if (seedOrganizationIds.length > 0) {
    await db.delete(organizations).where(inArray(organizations.id, seedOrganizationIds));
  }

  if (seedUsers.length > 0) {
    await db.delete(profiles).where(eq(profiles.userId, seedUsers[0].id));
    await db.delete(users).where(eq(users.id, seedUsers[0].id));
  }
  await db.delete(profiles).where(inArray(profiles.userId, contributorIds));
  await db.delete(users).where(inArray(users.id, contributorIds));
}
