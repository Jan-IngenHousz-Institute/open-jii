import { eq } from "drizzle-orm";

import { db } from "../../src/database";
import { protocols, macros, experiments, workbooks, workbookVersions } from "../../src/schema";
import type { SeedExperiment, SeedProtocol, SeedUser } from "./types";

/** Workbooks with a published version, pinned to the experiments that chart real data. */
export async function seedWorkbooks(
  user: SeedUser,
  personalOrganizationId: string,
  createdExperiments: SeedExperiment[],
  createdProtocols: SeedProtocol[],
) {
  const ex = createdExperiments;
  const p = createdProtocols;
  // 7. Workbooks with a published version, pinned to two active experiments so
  // device onboarding configs carry a real procedure. Soil Health stays
  // unpinned to exercise the workbook-less config path. Like the real publish
  // flow, each version snapshots its referenced protocol's code so the config
  // is executable without a lookup. Corn pairs with an ambyte protocol (its
  // bound device is the Ambyte gateway); wheat with a multispeq one.
  const cornQuestion = {
    id: crypto.randomUUID(),
    type: "question",
    name: "plot",
    question: {
      kind: "multi_choice",
      text: "Which plot is this device stationed at?",
      options: ["A1", "A2", "B1", "B2"],
      required: true,
    },
    isCollapsed: false,
    isAnswered: false,
  };

  const workbookSeeds = [
    {
      name: "[Seed] Corn Measurement Workbook",
      description: "Measurement procedure for the corn photosynthesis field trial.",
      experimentId: ex[0].id,
      intro: "## Corn field procedure\nLog soil moisture at each plot marker.",
      protocol: p[6],
      question: cornQuestion,
    },
    {
      name: "[Seed] Wheat Phenotyping Workbook",
      description: "Flag leaf measurement procedure for the winter wheat phenotyping study.",
      experimentId: ex[3].id,
      intro: "## Wheat procedure\nMeasure the flag leaf at mid-blade, avoiding the midrib.",
      protocol: p[2],
      question: null,
    },
  ];

  for (const wb of workbookSeeds) {
    const cells = [
      {
        id: crypto.randomUUID(),
        type: "markdown",
        content: wb.intro,
        isCollapsed: false,
      },
      ...(wb.question ? [wb.question] : []),
      {
        id: crypto.randomUUID(),
        type: "protocol",
        payload: { protocolId: wb.protocol.id, version: 1, name: wb.protocol.name },
        isCollapsed: false,
      },
    ];

    const [workbook] = await db
      .insert(workbooks)
      .values({
        name: wb.name,
        description: wb.description,
        cells,
        createdBy: user.id,
        organizationId: personalOrganizationId,
      })
      .returning();

    const [version] = await db
      .insert(workbookVersions)
      .values({
        workbookId: workbook.id,
        version: 1,
        cells,
        metadata: {},
        entitySnapshots: {
          protocols: {
            [wb.protocol.id]: { code: wb.protocol.code, family: wb.protocol.family },
          },
          macros: {},
        },
        createdBy: user.id,
      })
      .returning();

    await db
      .update(experiments)
      .set({ workbookId: workbook.id, workbookVersionId: version.id })
      .where(eq(experiments.id, wb.experimentId));
  }

  console.log(`  Created ${workbookSeeds.length} workbooks (pinned versions)`);
}
