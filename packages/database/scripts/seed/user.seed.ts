import { db } from "../../src/database";
import { ensurePersonalOrganization } from "../../src/organizations";
import { users, profiles } from "../../src/schema";
import { NEWCOMER_EMAIL, SEED_EMAIL } from "./constants";

/** The account every other seeded row belongs to, and the personal organization it owns. */
export async function seedUser() {
  // 1. Create seed user + profile
  const [user] = await db
    .insert(users)
    .values({
      name: "Seed User",
      email: SEED_EMAIL,
      emailVerified: true,
      registered: true,
    })
    .returning();

  await db.insert(profiles).values({
    userId: user.id,
    firstName: "Seed",
    lastName: "User",
    activated: true,
  });

  // Provision the seed user's personal organization (Phase 1 org provisioning).
  const personalOrganizationId = await ensurePersonalOrganization(db, user);

  console.log(`  Created user: ${user.id}`);

  return { user, personalOrganizationId };
}

/** An activated account for documentation captures that need an empty dashboard. */
export async function seedNewcomer() {
  const [user] = await db
    .insert(users)
    .values({
      name: "Newcomer",
      email: NEWCOMER_EMAIL,
      emailVerified: true,
      registered: true,
    })
    .returning();

  await db.insert(profiles).values({
    userId: user.id,
    firstName: "Newcomer",
    lastName: "User",
    activated: true,
  });

  // Signup provisions a personal organization for every user. The newcomer gets
  // no experiment grants or memberships in shared organizations.
  await ensurePersonalOrganization(db, user);

  console.log(`  Created newcomer user: ${user.id}`);
  return user;
}
