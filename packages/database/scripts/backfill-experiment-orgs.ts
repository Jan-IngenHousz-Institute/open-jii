import { db } from "../src/database";
import {
  backfillExperimentOrganizationsAndGrants,
  backfillOwnedEntitiesOwnership,
} from "../src/resource-grants";

/**
 * One-off backfill (run after backfill-personal-orgs): assign every resource
 * (experiments, macros, protocols, workbooks) to its creator's personal org and
 * mirror existing membership/ownership into resource_grants. Idempotent.
 */
async function main() {
  console.log("Backfilling resource organizations + grants...");
  const { experimentsUpdated, grantsCreated } = await backfillExperimentOrganizationsAndGrants(db);
  const owned = await backfillOwnedEntitiesOwnership(db);
  console.log(
    `Done. experiments=${experimentsUpdated} (+${grantsCreated} grants), ` +
      `macros=${owned.macros}, protocols=${owned.protocols}, workbooks=${owned.workbooks}.`,
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
