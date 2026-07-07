import { eq, isNull } from "drizzle-orm";

import { db } from "../src/database";
import { ensurePersonalOrganization } from "../src/organizations";
import { profiles, users } from "../src/schema";

/**
 * One-off backfill: ensure every existing user with an active profile owns a
 * personal organization. Idempotent — safe to re-run.
 *
 * Scope rules:
 *  - Only users that have a profile are provisioned. Users without a profile
 *    haven't completed registration yet and get their org when they do.
 *  - Soft-deleted accounts (profiles.deletedAt set) are skipped entirely — we
 *    never create orgs/memberships for deleted users.
 *  - The workspace name is derived from the profile's first + last name (the
 *    authoritative human name), not the Better Auth users.name (often blank).
 *
 * New users are provisioned by the auth `databaseHooks` instead.
 */
async function main() {
  const profiledUsers = await db
    .select({
      id: users.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(isNull(profiles.deletedAt));

  console.log(
    `Backfilling personal organizations for ${profiledUsers.length} active-profile user(s)...`,
  );

  let created = 0;
  for (const user of profiledUsers) {
    await ensurePersonalOrganization(db, {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
    });
    created += 1;
    if (created % 50 === 0) {
      console.log(`  ...${created}/${profiledUsers.length}`);
    }
  }

  console.log(`Done. Ensured personal organizations for ${created} user(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$client.end();
  });
