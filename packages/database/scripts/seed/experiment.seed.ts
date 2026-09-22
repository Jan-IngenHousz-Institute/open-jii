import { and } from "drizzle-orm";

import { db } from "../../src/database";
import { upsertGrant } from "../../src/resource-grants";
import { experiments } from "../../src/schema";
import {
  EXPERIMENT_ID_SOIL_HEALTH,
  EXPERIMENT_ID_WINTER_WHEAT,
  EXPERIMENT_ID_CORN_QUESTIONS,
} from "./constants";
import type { SeedUser } from "./types";

/** Experiments, two of them on fixed ids so they line up with real measurement data. */
export async function seedExperiments(user: SeedUser, personalOrganizationId: string) {
  // 5. Create experiments. Two experiments use fixed UUIDs so they line up
  // with dev/staging Databricks measurement data; the other three get
  // generated UUIDs as before.
  const experimentData: {
    id?: string;
    name: string;
    description: string;
    status: "active" | "published" | "archived";
    visibility: "public" | "private";
  }[] = [
    {
      id: EXPERIMENT_ID_CORN_QUESTIONS,
      name: "[Seed] Field Trial 2025 — Corn Photosynthesis",
      description:
        "Active field trial measuring photosynthetic efficiency across corn varieties in central Iowa.",
      status: "active",
      visibility: "public",
    },
    {
      name: "[Seed] Soybean Drought Response Study",
      description:
        "Published study on soybean physiological response to water stress conditions under controlled irrigation.",
      status: "published",
      visibility: "public",
    },
    {
      name: "[Seed] Indoor Lighting Calibration",
      description:
        "Archived calibration experiment for indoor growth chamber light sensors and PAR meters.",
      status: "archived",
      visibility: "private",
    },
    {
      id: EXPERIMENT_ID_WINTER_WHEAT,
      name: "[Seed] Winter Wheat Phenotyping",
      description:
        "Active high-throughput phenotyping study of winter wheat cultivars for cold tolerance traits.",
      status: "active",
      visibility: "public",
    },
    {
      id: EXPERIMENT_ID_SOIL_HEALTH,
      name: "[Seed] Soil Health Monitoring — Midwest",
      description:
        "Long-running soil health monitoring across multiple sites in the US Midwest, tracking EC, pH, and moisture.",
      status: "active",
      visibility: "public",
    },
  ];

  const createdExperiments = [];
  for (const e of experimentData) {
    const { id, ...rest } = e;
    const [experiment] = await db
      .insert(experiments)
      .values({
        ...(id ? { id } : {}),
        ...rest,
        createdBy: user.id,
        organizationId: personalOrganizationId,
        embargoUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .returning();
    createdExperiments.push(experiment);

    // Access comes from grants alone: the seeded owner gets the admin tier, exactly
    // as create-experiment does at runtime, and that grant is what the staffing
    // queries (last-admin protection, the deletion blocker) read.
    await upsertGrant(db, {
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: user.id,
      role: "admin",
      createdBy: user.id,
    });
  }

  console.log(`  Created ${createdExperiments.length} experiments`);

  return createdExperiments;
}
