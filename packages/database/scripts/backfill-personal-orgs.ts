import { db } from "../src/database";
import { ensurePersonalOrganization } from "../src/organizations";
import { users } from "../src/schema";

/**
 * One-off backfill: ensure every existing user owns a personal organization.
 * Idempotent — safe to re-run. New users are provisioned by the auth
 * `databaseHooks.user.create.after` hook instead.
 */
async function main() {
  const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
  console.log(`Backfilling personal organizations for ${allUsers.length} user(s)...`);

  let created = 0;
  for (const user of allUsers) {
    await ensurePersonalOrganization(db, user);
    created += 1;
    if (created % 50 === 0) {
      console.log(`  ...${created}/${allUsers.length}`);
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
