import { db } from "../../src/database";
import { notifications } from "../../src/schema";
import { CONTRIBUTOR_SEEDS } from "./constants";
import type { SeedExperiment, SeedUser } from "./types";

const MINUTE = 60_000;

/** A spread of types, ages and read states, so the bell and the page show every row shape. */
export async function seedNotifications(
  user: SeedUser,
  personalOrganizationId: string,
  createdExperiments: SeedExperiment[],
) {
  const [first, second, third, fourth] = CONTRIBUTOR_SEEDS;
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * MINUTE);
  const experiment = (index: number) => createdExperiments[index % createdExperiments.length];

  const rows: (typeof notifications.$inferInsert)[] = [
    {
      type: "experiment_join_request_received",
      actorId: first.id,
      resourceType: "experiment",
      resourceId: experiment(0).id,
      params: { experimentName: experiment(0).name },
      createdAt: at(5),
    },
    {
      type: "organization_invitation_received",
      actorId: second.id,
      resourceType: "organization",
      resourceId: personalOrganizationId,
      params: { organizationName: "Greenhouse Physiology Lab", role: "member" },
      createdAt: at(40),
    },
    {
      type: "resource_access_granted",
      actorId: third.id,
      resourceType: "experiment",
      resourceId: experiment(3).id,
      params: { resourceName: experiment(3).name, role: "viewer" },
      createdAt: at(3 * 60),
    },
    {
      type: "data_export_completed",
      resourceType: "experiment",
      resourceId: experiment(1).id,
      params: { experimentName: experiment(1).name, format: "CSV" },
      readAt: at(4 * 60),
      createdAt: at(5 * 60),
    },
    {
      type: "experiment_join_request_approved",
      actorId: fourth.id,
      resourceType: "experiment",
      resourceId: experiment(4).id,
      params: { experimentName: experiment(4).name },
      readAt: at(20 * 60),
      createdAt: at(26 * 60),
    },
    {
      type: "project_transfer_completed",
      resourceType: "experiment",
      resourceId: experiment(2).id,
      params: { experimentName: experiment(2).name },
      readAt: at(40 * 60),
      createdAt: at(2 * 24 * 60),
    },
    {
      type: "organization_join_request_rejected",
      resourceType: "organization",
      resourceId: personalOrganizationId,
      params: { organizationName: "Field Phenomics Network" },
      readAt: at(3 * 24 * 60),
      createdAt: at(3 * 24 * 60 + 30),
    },
    {
      type: "data_upload_failed",
      resourceType: "experiment",
      resourceId: experiment(0).id,
      params: { experimentName: experiment(0).name, fileName: "plot-14-readings.csv" },
      readAt: at(4 * 24 * 60),
      createdAt: at(4 * 24 * 60 + 10),
    },
    {
      type: "resource_access_revoked",
      actorId: first.id,
      resourceType: "macro",
      resourceId: experiment(1).id,
      params: { resourceName: "Leaf chlorophyll index" },
      readAt: at(6 * 24 * 60),
      createdAt: at(6 * 24 * 60 + 5),
    },
    {
      type: "workbook_version_published",
      resourceType: "experiment",
      resourceId: experiment(2).id,
      params: {
        experimentName: experiment(2).name,
        workbookName: "Leaf photosynthesis workflow",
        version: "4",
      },
      readAt: at(7 * 24 * 60),
      createdAt: at(7 * 24 * 60 + 5),
    },
    {
      type: "api_key_created",
      params: { keyName: "Field laptop sync" },
      readAt: at(7 * 24 * 60),
      createdAt: at(7 * 24 * 60 + 30),
    },
    {
      type: "project_transfer_requested",
      params: { projectId: "12345" },
      readAt: at(8 * 24 * 60),
      createdAt: at(8 * 24 * 60 + 5),
    },
  ];

  await db.insert(notifications).values(rows.map((row) => ({ ...row, recipientId: user.id })));
  console.log(`  Created ${rows.length} notifications for the seed user`);
}
