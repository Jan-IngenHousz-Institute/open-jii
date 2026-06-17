import { db } from "../src/database";
import { backfillExperimentOrganizationsAndGrants } from "../src/resource-grants";

/**
 * One-off backfill (run after backfill-personal-orgs): assign each experiment to
 * its creator's personal org and mirror experiment_members into resource_grants.
 * Idempotent.
 */
async function main() {
  console.log("Backfilling experiment organizations + resource grants...");
  const { experimentsUpdated, grantsCreated } = await backfillExperimentOrganizationsAndGrants(db);
  console.log(
    `Done. Assigned org to ${experimentsUpdated} experiment(s); ensured ${grantsCreated} grant(s).`,
  );
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$client.end();
  });
