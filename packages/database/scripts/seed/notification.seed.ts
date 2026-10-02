import { db } from "../../src/database";
import { notifications } from "../../src/schema";
import { CONTRIBUTOR_SEEDS } from "./constants";
import type { SeedExperiment, SeedUser } from "./types";

const MINUTE = 60_000;

/**
 * One row per notification type the platform produces, across read states, so the
 * bell shows a dot and the page shows a read row. Grows as producers are added.
 */
export async function seedNotifications(user: SeedUser, createdExperiments: SeedExperiment[]) {
  const [first, second, third] = CONTRIBUTOR_SEEDS;
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * MINUTE);
  const experiment = (index: number) => createdExperiments[index % createdExperiments.length];

  const rows: Omit<typeof notifications.$inferInsert, "recipientId">[] = [
    {
      type: "experiment_join_request_received",
      actorId: first.id,
      resourceType: "experiment",
      resourceId: experiment(0).id,
      params: {
        experimentName: experiment(0).name,
        message: "I run the neighbouring plots and would like to compare readings.",
      },
      createdAt: at(5),
    },
    {
      type: "experiment_join_request_approved",
      actorId: second.id,
      resourceType: "experiment",
      resourceId: experiment(1).id,
      params: { experimentName: experiment(1).name },
      readAt: at(20 * 60),
      createdAt: at(26 * 60),
    },
    {
      type: "experiment_join_request_rejected",
      actorId: third.id,
      resourceType: "experiment",
      resourceId: experiment(2).id,
      params: { experimentName: experiment(2).name },
      readAt: at(3 * 24 * 60),
      createdAt: at(3 * 24 * 60 + 30),
    },
  ];

  await db.insert(notifications).values(rows.map((row) => ({ ...row, recipientId: user.id })));
  console.log(`  Created ${rows.length} notifications for the seed user`);
}
