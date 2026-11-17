import { experiments, ne, sql } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";

export function searchableExperimentCondition(database: DatabaseInstance, userId: string): SQL {
  const access = accessibleResourceCondition({
    database,
    resourceType: "experiment",
    resourceIdColumn: experiments.id,
    organizationIdColumn: experiments.organizationId,
    visibilityColumn: experiments.visibility,
    userId,
  });
  if (!access) {
    throw new Error("Experiment search requires an access scope");
  }
  // and() drops undefined operands, so validate the scope before combining it.
  return sql`(${access} AND ${ne(experiments.status, "archived")})`;
}
