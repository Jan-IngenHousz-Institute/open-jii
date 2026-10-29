import { db } from "../../src/postgres/database";
import { resourceVisits } from "../../src/postgres/schema";
import type { SeedExperiment, SeedMacro, SeedProtocol, SeedUser, SeedWorkbook } from "./types";

const MINUTE = 60_000;

/**
 * Recent opens of every type at different ages, so the home's Recently opened is full,
 * offers a chip per type, and each row shows a different "Opened" time. The newcomer gets
 * none and sees the first-work cards.
 */
export async function seedVisits(
  user: SeedUser,
  created: {
    experiments: SeedExperiment[];
    protocols: SeedProtocol[];
    macros: SeedMacro[];
    workbooks: SeedWorkbook[];
  },
) {
  const openable = created.experiments.filter((experiment) => experiment.status !== "archived");
  const opens: {
    resourceType: (typeof resourceVisits.$inferInsert)["resourceType"];
    resource: { id: string };
    minutesAgo: number;
  }[] = [
    { resourceType: "experiment", resource: openable[0], minutesAgo: 10 },
    { resourceType: "workbook", resource: created.workbooks[0], minutesAgo: 60 },
    { resourceType: "protocol", resource: created.protocols[0], minutesAgo: 26 * 60 },
    { resourceType: "experiment", resource: openable[1], minutesAgo: 2 * 24 * 60 },
    { resourceType: "macro", resource: created.macros[0], minutesAgo: 3 * 24 * 60 },
    { resourceType: "experiment", resource: openable[2], minutesAgo: 4 * 24 * 60 },
  ];

  const rows = opens.map(({ resourceType, resource, minutesAgo }) => ({
    userId: user.id,
    resourceType,
    resourceId: resource.id,
    visitedAt: new Date(Date.now() - minutesAgo * MINUTE),
  }));

  await db.insert(resourceVisits).values(rows);
  console.log(`  Created ${rows.length} visits for the seed user`);
}
