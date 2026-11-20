import { eq, experiments, ne, or, sql } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { readingResourceCondition } from "../../../common/utils/resource-access-scope";

export function searchableExperimentCondition(database: DatabaseInstance, userId: string): SQL {
  const related = readingResourceCondition({
    database,
    resourceType: "experiment",
    resourceIdColumn: experiments.id,
    organizationIdColumn: experiments.organizationId,
    userId,
  });
  if (!related) {
    throw new Error("Experiment search requires an access scope");
  }
  const access = or(eq(experiments.visibility, "public"), related);
  return sql`(${access} AND ${ne(experiments.status, "archived")})`;
}
