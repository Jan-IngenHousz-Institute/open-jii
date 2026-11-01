import { and, eq, inArray, or } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

import { zCreateExperimentDashboardBody } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { zCreateExperimentVisualizationBody } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { zJsonValue } from "@repo/api/domains/protocol/protocol.schema";
import { zWorkbookCellArrayInput } from "@repo/api/domains/workbook/workbook-cells.schema";
import { zEntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";

import type { DatabaseInstance } from "../../src/postgres/database";
import { db } from "../../src/postgres/database";
import { upsertGrant } from "../../src/postgres/resource-grants";
import {
  calibrationDefinitions,
  calibrationRuns,
  deviceGroups,
  iotDevices,
  experimentDashboards,
  experimentMembers,
  experiments,
  experimentVisualizations,
  invitations,
  macros,
  organizationMembers,
  organizations,
  protocolMacros,
  protocols,
  resourceGrants,
  resourceVisits,
  teams,
  workbooks,
  workbookVersions,
} from "../../src/postgres/schema";
import { DEMO_ORGANIZATION_ID, DEMO_SEED_FIXTURES } from "./constants";
import type { SeedUser } from "./types";

const manifestSchema = z.object({
  family: z.enum(["multispeq", "ambit", "minipar"]),
  placeholder: z.literal(true),
  protocolName: z.string().min(1),
  macroName: z.string().min(1),
  expectedOutput: z.record(z.string(), z.number().finite()),
});

async function loadDefinitions() {
  return Promise.all(
    DEMO_SEED_FIXTURES.map(async (fixture) => {
      const folder = resolve(__dirname, "../../../iot/src/demo-sensors", fixture.family);
      const manifest = manifestSchema.parse(
        JSON.parse(await readFile(resolve(folder, "manifest.json"), "utf8")),
      );
      if (manifest.family !== fixture.family) throw new Error("Demo sensor family mismatch");
      const protocol = z
        .array(zJsonValue)
        .min(1)
        .parse(JSON.parse(await readFile(resolve(folder, "protocol.json"), "utf8")));
      const macro = await readFile(resolve(folder, "macro.py"), "utf8");
      if (!macro.trim()) throw new Error("Demo macro is empty");
      return { ...fixture, manifest, protocol, macro: Buffer.from(macro).toString("base64") };
    }),
  );
}

/** Clear with clearDemoContent before calling again; inserts are not idempotent on their own. */
export async function seedDemoContent(user: SeedUser, database: DatabaseInstance = db) {
  const definitions = await loadDefinitions();
  await database.transaction(async (tx) => {
    // The Demo triggers require its public organization to exist before its resources.
    await tx.insert(organizations).values({
      id: DEMO_ORGANIZATION_ID,
      name: "openJII Demo",
      slug: "openjii-demo",
      type: "demo",
      visibility: "public",
      description: "Synthetic sensor examples. Public sample content for exploring openJII.",
    });
    await tx.insert(organizationMembers).values({
      organizationId: DEMO_ORGANIZATION_ID,
      userId: user.id,
      role: "owner",
    });

    for (const sensor of definitions) {
      const name = `[Seed] ${sensor.label} Demo Example`;
      const description = `Synthetic ${sensor.label} example. Placeholder content, not validated for real hardware.`;
      const ownership = {
        organizationId: DEMO_ORGANIZATION_ID,
        createdBy: user.id,
        visibility: "public" as const,
      };
      const protocolName = `[Seed] Example: ${sensor.manifest.protocolName}`;
      const macroName = `[Seed] Example: ${sensor.manifest.macroName}`;
      await tx.insert(protocols).values({
        id: sensor.protocolId,
        name: protocolName,
        description,
        family: sensor.family,
        code: sensor.protocol,
        ...ownership,
      });
      await tx.insert(macros).values({
        id: sensor.macroId,
        name: macroName,
        filename: `seed_demo_${sensor.family}`,
        description,
        language: "python",
        code: sensor.macro,
        ...ownership,
      });
      await tx.insert(protocolMacros).values({
        protocolId: sensor.protocolId,
        macroId: sensor.macroId,
      });
      const cells = zWorkbookCellArrayInput.parse([
        {
          id: `${sensor.family}-intro`,
          type: "markdown",
          content: `## ${sensor.label} Example\n\nSynthetic placeholder protocol and analysis. This is not a hardware-validated procedure. Run the protocol before the analysis macro.`,
        },
        {
          id: `${sensor.family}-protocol`,
          type: "protocol",
          payload: { protocolId: sensor.protocolId, version: 1, name: protocolName },
        },
        {
          id: `${sensor.family}-macro`,
          type: "macro",
          payload: { macroId: sensor.macroId, language: "python", name: macroName },
        },
      ]);
      await tx.insert(workbooks).values({
        id: sensor.workbookId,
        name: `${name} Workbook`,
        description,
        cells,
        ...ownership,
      });
      await tx.insert(workbookVersions).values({
        id: sensor.versionId,
        workbookId: sensor.workbookId,
        version: 1,
        cells,
        createdBy: user.id,
        entitySnapshots: zEntitySnapshots.parse({
          protocols: { [sensor.protocolId]: { code: sensor.protocol, family: sensor.family } },
          macros: { [sensor.macroId]: { code: sensor.macro, language: "python" } },
        }),
      });
      await tx.insert(experiments).values({
        id: sensor.experimentId,
        name,
        description,
        status: "active",
        workbookId: sensor.workbookId,
        workbookVersionId: sensor.versionId,
        ...ownership,
      });
      for (const [resourceType, resourceId] of [
        ["experiment", sensor.experimentId],
        ["protocol", sensor.protocolId],
        ["macro", sensor.macroId],
        ["workbook", sensor.workbookId],
      ] as const) {
        await upsertGrant(tx, {
          resourceType,
          resourceId,
          granteeType: "user",
          granteeId: user.id,
          role: "admin",
          createdBy: user.id,
        });
      }
      const metric = Object.keys(sensor.manifest.expectedOutput)[0];
      const chart = zCreateExperimentVisualizationBody.parse({
        name: `${name} ${metric}`,
        description,
        chartFamily: "basic",
        chartType: "line",
        config: { mode: "lines", xAxisType: "date", showLegend: false },
        dataConfig: {
          tableName: sensor.macroId,
          dataSources: [
            { tableName: sensor.macroId, columnName: "timestamp", role: "x" },
            { tableName: sensor.macroId, columnName: metric, role: "y" },
          ],
        },
      });
      await tx.insert(experimentVisualizations).values({
        ...chart,
        config: chart.config ?? {},
        id: sensor.chartId,
        experimentId: sensor.experimentId,
        createdBy: user.id,
      });
      const dashboard = zCreateExperimentDashboardBody.parse({
        name: `${name} Dashboard`,
        description,
        widgets: [
          {
            id: sensor.introWidgetId,
            type: "richText",
            layout: { col: 0, row: 0, colSpan: 12, rowSpan: 2 },
            config: {
              html: `<h2>${sensor.label} Example</h2><p>Synthetic placeholder content. Local charts have no lakehouse data; no real measurements are shown.</p>`,
            },
          },
          {
            id: sensor.chartWidgetId,
            type: "visualization",
            layout: { col: 0, row: 2, colSpan: 12, rowSpan: 5 },
            config: { visualizationId: sensor.chartId, showTitle: true },
          },
        ],
      });
      await tx.insert(experimentDashboards).values({
        ...dashboard,
        id: sensor.dashboardId,
        experimentId: sensor.experimentId,
        createdBy: user.id,
      });
    }
  });
  console.log("  Created openJII Demo with three synthetic sensor examples");
}

export async function clearDemoContent(database: DatabaseInstance = db) {
  await database.transaction(async (tx) => {
    const demoTeams = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.organizationId, DEMO_ORGANIZATION_ID));
    if (demoTeams.length > 0) {
      await tx.delete(resourceGrants).where(
        and(
          eq(resourceGrants.granteeType, "team"),
          inArray(
            resourceGrants.granteeId,
            demoTeams.map((team) => team.id),
          ),
        ),
      );
    }
    const exp = await tx
      .select({ id: experiments.id })
      .from(experiments)
      .where(
        or(
          eq(experiments.organizationId, DEMO_ORGANIZATION_ID),
          inArray(
            experiments.id,
            DEMO_SEED_FIXTURES.map((s) => s.experimentId),
          ),
        ),
      );
    const wb = await tx
      .select({ id: workbooks.id })
      .from(workbooks)
      .where(
        or(
          eq(workbooks.organizationId, DEMO_ORGANIZATION_ID),
          inArray(
            workbooks.id,
            DEMO_SEED_FIXTURES.map((s) => s.workbookId),
          ),
        ),
      );
    const proto = await tx
      .select({ id: protocols.id })
      .from(protocols)
      .where(
        or(
          eq(protocols.organizationId, DEMO_ORGANIZATION_ID),
          inArray(
            protocols.id,
            DEMO_SEED_FIXTURES.map((s) => s.protocolId),
          ),
        ),
      );
    const macro = await tx
      .select({ id: macros.id })
      .from(macros)
      .where(
        or(
          eq(macros.organizationId, DEMO_ORGANIZATION_ID),
          inArray(
            macros.id,
            DEMO_SEED_FIXTURES.map((s) => s.macroId),
          ),
        ),
      );
    const definitions = await tx
      .select({ id: calibrationDefinitions.id })
      .from(calibrationDefinitions)
      .where(eq(calibrationDefinitions.organizationId, DEMO_ORGANIZATION_ID));
    const groups = await tx
      .select({ id: deviceGroups.id })
      .from(deviceGroups)
      .where(eq(deviceGroups.organizationId, DEMO_ORGANIZATION_ID));
    const devices = await tx
      .select({ id: iotDevices.id })
      .from(iotDevices)
      .where(eq(iotDevices.organizationId, DEMO_ORGANIZATION_ID));
    if (definitions.length > 0) {
      await tx.delete(calibrationRuns).where(
        inArray(
          calibrationRuns.definitionId,
          definitions.map((row) => row.id),
        ),
      );
    }
    for (const [resourceType, rows] of [
      ["experiment", exp],
      ["workbook", wb],
      ["protocol", proto],
      ["macro", macro],
      ["calibration_definition", definitions],
      ["device_group", groups],
      ["device", devices],
    ] as const) {
      const ids = rows.map((row) => row.id);
      if (ids.length === 0) continue;
      await tx
        .delete(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            inArray(resourceGrants.resourceId, ids),
          ),
        );
      await tx
        .delete(resourceVisits)
        .where(
          and(
            eq(resourceVisits.resourceType, resourceType),
            inArray(resourceVisits.resourceId, ids),
          ),
        );
      if (resourceType === "experiment") {
        await tx
          .delete(invitations)
          .where(
            and(eq(invitations.resourceType, "experiment"), inArray(invitations.resourceId, ids)),
          );
      }
    }
    if (exp.length > 0) {
      await tx.delete(experimentMembers).where(
        inArray(
          experimentMembers.experimentId,
          exp.map((row) => row.id),
        ),
      );
      await tx.delete(experiments).where(
        inArray(
          experiments.id,
          exp.map((row) => row.id),
        ),
      );
    }
    if (wb.length > 0)
      await tx.delete(workbooks).where(
        inArray(
          workbooks.id,
          wb.map((row) => row.id),
        ),
      );
    if (proto.length > 0)
      await tx.delete(protocols).where(
        inArray(
          protocols.id,
          proto.map((row) => row.id),
        ),
      );
    if (macro.length > 0)
      await tx.delete(macros).where(
        inArray(
          macros.id,
          macro.map((row) => row.id),
        ),
      );
    if (definitions.length > 0)
      await tx.delete(calibrationDefinitions).where(
        inArray(
          calibrationDefinitions.id,
          definitions.map((row) => row.id),
        ),
      );
    if (groups.length > 0)
      await tx.delete(deviceGroups).where(
        inArray(
          deviceGroups.id,
          groups.map((row) => row.id),
        ),
      );
    if (devices.length > 0)
      await tx.delete(iotDevices).where(
        inArray(
          iotDevices.id,
          devices.map((row) => row.id),
        ),
      );
    await tx
      .delete(resourceGrants)
      .where(
        and(
          eq(resourceGrants.granteeType, "organization"),
          eq(resourceGrants.granteeId, DEMO_ORGANIZATION_ID),
        ),
      );
    await tx.delete(organizations).where(eq(organizations.id, DEMO_ORGANIZATION_ID));
  });
}
