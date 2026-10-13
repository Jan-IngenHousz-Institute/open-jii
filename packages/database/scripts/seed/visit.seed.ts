import { db } from "../../src/database";
import { resourceVisits } from "../../src/schema";
import type { SeedExperiment, SeedUser } from "./types";

const MINUTE = 60_000;

/**
 * Three recent opens with different ages, so the home row is filled and each card
 * shows a different "Opened" time. The newcomer gets none and sees the first-work cards.
 */
export async function seedVisits(user: SeedUser, createdExperiments: SeedExperiment[]) {
  const openable = createdExperiments.filter((experiment) => experiment.status !== "archived");
  const minutesAgo = [10, 3 * 60, 2 * 24 * 60];

  const rows = openable.slice(0, minutesAgo.length).map((experiment, index) => ({
    userId: user.id,
    resourceType: "experiment" as const,
    resourceId: experiment.id,
    visitedAt: new Date(Date.now() - minutesAgo[index] * MINUTE),
  }));

  await db.insert(resourceVisits).values(rows);
  console.log(`  Created ${rows.length} experiment visits for the seed user`);
}
