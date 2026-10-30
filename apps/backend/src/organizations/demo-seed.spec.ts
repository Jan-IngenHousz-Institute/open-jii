import { readFile } from "node:fs/promises";
import type * as FileSystem from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

import { zCreateExperimentDashboardBody } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { zCreateExperimentVisualizationBody } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { zWorkbookCellArrayInput } from "@repo/api/domains/workbook/workbook-cells.schema";
import { zEntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";
import {
  and,
  calibrationDefinitions,
  calibrationRuns,
  deviceCalibrations,
  deviceGroupMembers,
  deviceGroups,
  iotDevices,
  eq,
  inArray,
  experimentDashboards,
  experiments,
  experimentVisualizations,
  macros,
  organizationJoinRequests,
  organizationMembers,
  organizations,
  protocolMacros,
  protocols,
  resourceGrants,
  resourceVisits,
  teams,
  users,
  workbooks,
  workbookVersions,
} from "@repo/database";
import { DEMO_ORGANIZATION_ID, DEMO_SEED_FIXTURES } from "@repo/database/seed/constants";
import { clearDemoContent, seedDemoContent } from "@repo/database/seed/demo";

import { TestHarness } from "../test/test-harness";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystem>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

describe("Local demo seed", () => {
  const app = TestHarness.App;
  beforeAll(() => app.setup());
  beforeEach(() => app.beforeEach());
  afterEach(() => {
    vi.mocked(readFile).mockReset();
    app.afterEach();
  });
  afterAll(() => app.teardown());

  function findRow<T extends { id: string }>(rows: T[], id: string): T {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`Missing demo fixture ${id}`);
    return row;
  }

  async function fixture() {
    const ownerId = await app.createTestUser();
    const newcomerId = await app.createTestUser();
    const [owner] = await app.database.select().from(users).where(eq(users.id, ownerId));
    await seedDemoContent(owner, app.database);
    return { owner, newcomerId };
  }

  async function graph() {
    return {
      organizations: await app.database
        .select()
        .from(organizations)
        .where(eq(organizations.id, DEMO_ORGANIZATION_ID)),
      experiments: await app.database
        .select()
        .from(experiments)
        .where(
          inArray(
            experiments.id,
            DEMO_SEED_FIXTURES.map((s) => s.experimentId),
          ),
        ),
      workbooks: await app.database
        .select()
        .from(workbooks)
        .where(
          inArray(
            workbooks.id,
            DEMO_SEED_FIXTURES.map((s) => s.workbookId),
          ),
        ),
      versions: await app.database
        .select()
        .from(workbookVersions)
        .where(
          inArray(
            workbookVersions.id,
            DEMO_SEED_FIXTURES.map((s) => s.versionId),
          ),
        ),
      protocols: await app.database
        .select()
        .from(protocols)
        .where(
          inArray(
            protocols.id,
            DEMO_SEED_FIXTURES.map((s) => s.protocolId),
          ),
        ),
      macros: await app.database
        .select()
        .from(macros)
        .where(
          inArray(
            macros.id,
            DEMO_SEED_FIXTURES.map((s) => s.macroId),
          ),
        ),
      dashboards: await app.database
        .select()
        .from(experimentDashboards)
        .where(
          inArray(
            experimentDashboards.id,
            DEMO_SEED_FIXTURES.map((s) => s.dashboardId),
          ),
        ),
      charts: await app.database
        .select()
        .from(experimentVisualizations)
        .where(
          inArray(
            experimentVisualizations.id,
            DEMO_SEED_FIXTURES.map((s) => s.chartId),
          ),
        ),
    };
  }

  it.each([
    { file: "manifest.json", error: "Demo sensor family mismatch" },
    { file: "macro.py", error: "Demo macro is empty" },
  ])("refuses an invalid $file before creating Demo content", async ({ file, error }) => {
    const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
    const folder = resolve(__dirname, "../../../../packages/iot/src/demo-sensors/multispeq");
    vi.mocked(readFile).mockImplementation(async (path, options) => {
      const contents = await actual.readFile(path, options);
      if (path !== resolve(folder, file)) return contents;
      if (file === "macro.py") return " \n\t";
      return JSON.stringify({
        ...z.record(z.string(), z.unknown()).parse(JSON.parse(String(contents))),
        family: "ambit",
      });
    });
    const ownerId = await app.createTestUser();
    const [owner] = await app.database.select().from(users).where(eq(users.id, ownerId));

    await expect(seedDemoContent(owner, app.database)).rejects.toThrow(error);

    for (const rows of Object.values(await graph())) expect(rows).toHaveLength(0);
    expect(
      await app.database.select().from(resourceGrants).where(eq(resourceGrants.granteeId, ownerId)),
    ).toHaveLength(0);
  });

  it("clears safely before seeding and after a previous cleanup", async () => {
    await clearDemoContent(app.database);
    const { owner } = await fixture();
    await clearDemoContent(app.database);
    await clearDemoContent(app.database);
    for (const rows of Object.values(await graph())) expect(rows).toHaveLength(0);

    await seedDemoContent(owner, app.database);

    for (const [key, rows] of Object.entries(await graph())) {
      expect(rows).toHaveLength(key === "organizations" ? 1 : 3);
    }
  });

  it("pins complete public family graphs with the exact shared definitions", async () => {
    const { owner, newcomerId } = await fixture();
    const rows = await graph();
    expect(rows.organizations).toMatchObject([
      { name: "openJII Demo", type: "demo", visibility: "public" },
    ]);
    for (const [key, values] of Object.entries(rows)) {
      expect(values).toHaveLength(key === "organizations" ? 1 : 3);
    }
    const members = await app.database
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, DEMO_ORGANIZATION_ID));
    expect(members).toMatchObject([{ userId: owner.id, role: "owner" }]);
    expect(
      await app.database
        .select()
        .from(resourceGrants)
        .where(eq(resourceGrants.granteeId, newcomerId)),
    ).toHaveLength(0);
    expect(owner.role).not.toBe("admin");

    for (const sensor of DEMO_SEED_FIXTURES) {
      const experiment = findRow(rows.experiments, sensor.experimentId);
      const workbook = findRow(rows.workbooks, sensor.workbookId);
      const version = findRow(rows.versions, sensor.versionId);
      const protocol = findRow(rows.protocols, sensor.protocolId);
      const macro = findRow(rows.macros, sensor.macroId);
      const dashboard = findRow(rows.dashboards, sensor.dashboardId);
      const chart = findRow(rows.charts, sensor.chartId);
      for (const row of [experiment, workbook, protocol, macro]) {
        expect(row).toMatchObject({
          organizationId: DEMO_ORGANIZATION_ID,
          visibility: "public",
          createdBy: owner.id,
        });
        expect(row.name).toMatch(/^\[Seed\].*Example/);
      }
      expect(experiment).toMatchObject({
        workbookId: workbook.id,
        workbookVersionId: version.id,
        status: "active",
      });
      const cells = zWorkbookCellArrayInput.parse(workbook.cells);
      expect(cells.map((cell) => cell.type)).toEqual(["markdown", "protocol", "macro"]);
      expect(cells[1]).toMatchObject({ payload: { protocolId: protocol.id } });
      expect(cells[2]).toMatchObject({ payload: { macroId: macro.id, language: "python" } });
      expect(version.cells).toEqual(workbook.cells);
      const snapshots = zEntitySnapshots.parse(version.entitySnapshots);
      expect(snapshots.protocols[protocol.id]).toEqual({
        code: protocol.code,
        family: sensor.family,
      });
      expect(snapshots.macros[macro.id]).toEqual({ code: macro.code, language: "python" });
      const folder = resolve(__dirname, "../../../../packages/iot/src/demo-sensors", sensor.family);
      expect(protocol.code).toEqual(
        JSON.parse(await readFile(resolve(folder, "protocol.json"), "utf8")),
      );
      expect(Buffer.from(macro.code, "base64").toString("utf8")).toBe(
        await readFile(resolve(folder, "macro.py"), "utf8"),
      );
      expect(
        await app.database
          .select()
          .from(protocolMacros)
          .where(
            and(eq(protocolMacros.protocolId, protocol.id), eq(protocolMacros.macroId, macro.id)),
          ),
      ).toHaveLength(1);
      const manifest = z
        .object({ expectedOutput: z.record(z.string(), z.number()) })
        .parse(JSON.parse(await readFile(resolve(folder, "manifest.json"), "utf8")));
      const chartBody = zCreateExperimentVisualizationBody.parse(chart);
      expect(chartBody.dataConfig.tableName).toBe(macro.id);
      expect(chartBody.dataConfig.dataSources.map((source) => source.tableName)).toEqual([
        macro.id,
        macro.id,
      ]);
      expect(chartBody.dataConfig.dataSources[1].columnName).toBe(
        Object.keys(manifest.expectedOutput)[0],
      );
      const dashboardBody = zCreateExperimentDashboardBody.parse(dashboard);
      const widget = dashboardBody.widgets?.find((entry) => entry.type === "visualization");
      expect(widget?.config).toMatchObject({ visualizationId: chart.id });
      expect(dashboardBody.widgets?.map((entry) => entry.id)).toEqual([
        sensor.introWidgetId,
        sensor.chartWidgetId,
      ]);
      expect(dashboard.experimentId).toBe(experiment.id);
      expect(chart.experimentId).toBe(experiment.id);
      await app.database.update(workbooks).set({ cells: [] }).where(eq(workbooks.id, workbook.id));
      const [pinned] = await app.database
        .select()
        .from(workbookVersions)
        .where(eq(workbookVersions.id, version.id));
      expect(pinned.cells).toEqual(version.cells);
    }
  });

  it("restores renamed and ordinary/private fixtures, removing membership and request drift", async () => {
    const { owner, newcomerId } = await fixture();
    const dashboardsBefore = (await graph()).dashboards;
    const unrelatedId = await app.createTestUser();
    const unrelated = await app.createExperiment({
      userId: unrelatedId,
      name: "Unrelated preserved example",
    });
    await app.database
      .update(organizations)
      .set({
        name: "Renamed example",
        slug: "renamed-example",
        type: "university",
        visibility: "private",
      })
      .where(eq(organizations.id, DEMO_ORGANIZATION_ID));
    for (const sensor of DEMO_SEED_FIXTURES) {
      await app.database
        .update(experiments)
        .set({ name: `Renamed ${sensor.family}` })
        .where(eq(experiments.id, sensor.experimentId));
      await app.database
        .update(workbooks)
        .set({ name: `Renamed ${sensor.family}` })
        .where(eq(workbooks.id, sensor.workbookId));
      await app.database
        .update(protocols)
        .set({ name: `Renamed ${sensor.family}`, visibility: "private" })
        .where(eq(protocols.id, sensor.protocolId));
      await app.database
        .update(macros)
        .set({ name: `Renamed ${sensor.family}` })
        .where(eq(macros.id, sensor.macroId));
      await app.addResourceVisit({
        userId: newcomerId,
        resourceId: sensor.workbookId,
        resourceType: "workbook",
      });
    }
    await app.addOrganizationMember(DEMO_ORGANIZATION_ID, newcomerId);
    await app.database
      .insert(organizationJoinRequests)
      .values({ organizationId: DEMO_ORGANIZATION_ID, userId: newcomerId });
    const [team] = await app.database
      .insert(teams)
      .values({ name: "Example team", organizationId: DEMO_ORGANIZATION_ID })
      .returning();
    await app.addResourceGrant({
      resourceType: "experiment",
      resourceId: unrelated.experiment.id,
      granteeType: "team",
      granteeId: team.id,
      role: "viewer",
    });
    await clearDemoContent(app.database);
    expect(
      await app.database.select().from(resourceGrants).where(eq(resourceGrants.granteeId, team.id)),
    ).toHaveLength(0);
    expect(
      await app.database
        .select()
        .from(resourceGrants)
        .where(eq(resourceGrants.granteeId, owner.id)),
    ).toHaveLength(0);
    expect(
      await app.database.select().from(resourceVisits).where(eq(resourceVisits.userId, newcomerId)),
    ).toHaveLength(0);
    expect(
      await app.database
        .select()
        .from(organizationJoinRequests)
        .where(eq(organizationJoinRequests.organizationId, DEMO_ORGANIZATION_ID)),
    ).toHaveLength(0);
    await seedDemoContent(owner, app.database);
    const rows = await graph();
    expect(rows.organizations).toMatchObject([
      { name: "openJII Demo", type: "demo", visibility: "public" },
    ]);
    expect(rows.experiments).toHaveLength(3);
    for (const sensor of DEMO_SEED_FIXTURES) {
      expect(findRow(rows.dashboards, sensor.dashboardId).widgets).toEqual(
        findRow(dashboardsBefore, sensor.dashboardId).widgets,
      );
    }
    expect(rows.protocols.every((row) => row.visibility === "public")).toBe(true);
    const members = await app.database
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, DEMO_ORGANIZATION_ID));
    expect(members).toMatchObject([{ userId: owner.id, role: "owner" }]);
    expect(
      await app.database
        .select()
        .from(experiments)
        .where(eq(experiments.id, unrelated.experiment.id)),
    ).toHaveLength(1);
    expect(
      await app.database
        .select()
        .from(resourceGrants)
        .where(eq(resourceGrants.granteeId, owner.id)),
    ).toHaveLength(12);
  });

  it("clears private devices, groups, calibration definitions and their dependent rows before reseeding", async () => {
    const { owner, newcomerId } = await fixture();
    const [device] = await app.database
      .insert(iotDevices)
      .values({
        thingName: "demo-local-device",
        thingArn: "arn:local:demo-local-device",
        serialNumber: "demo-local-serial",
        deviceType: "multispeq",
        organizationId: DEMO_ORGANIZATION_ID,
        visibility: "private",
        createdBy: owner.id,
      })
      .returning();
    const [group] = await app.database
      .insert(deviceGroups)
      .values({
        name: "Local demo group",
        organizationId: DEMO_ORGANIZATION_ID,
        visibility: "private",
        createdBy: owner.id,
      })
      .returning();
    await app.database.insert(deviceGroupMembers).values({
      groupId: group.id,
      deviceId: device.id,
      addedBy: owner.id,
    });
    const [definition] = await app.database
      .insert(calibrationDefinitions)
      .values({
        name: "Local demo calibration",
        family: "multispeq",
        captureProcedure: [],
        script: "return {}",
        outputSchema: {},
        organizationId: DEMO_ORGANIZATION_ID,
        visibility: "private",
        createdBy: owner.id,
      })
      .returning();
    const [run] = await app.database
      .insert(calibrationRuns)
      .values({
        definitionId: definition.id,
        deviceId: device.id,
        requestedBy: owner.id,
        inputSource: "bench_wizard",
      })
      .returning();
    await app.database.insert(deviceCalibrations).values({
      deviceId: device.id,
      runId: run.id,
      blocks: {},
      approvedBy: owner.id,
    });
    const otherUserId = await app.createTestUser();
    const otherOrganizationId = await app.personalOrganizationId(otherUserId);
    const otherDevice = await app.createIotDevice({
      createdBy: otherUserId,
      organizationId: otherOrganizationId,
      deviceType: "multispeq",
    });
    const otherDefinition = await app.createCalibrationDefinition({
      name: "Preserved calibration",
      createdBy: otherUserId,
      organizationId: otherOrganizationId,
      family: "multispeq",
    });
    const [otherRun] = await app.database
      .insert(calibrationRuns)
      .values({
        definitionId: otherDefinition.id,
        deviceId: otherDevice.id,
        requestedBy: otherUserId,
        inputSource: "bench_wizard",
      })
      .returning();
    const [crossOrganizationRun] = await app.database
      .insert(calibrationRuns)
      .values({
        definitionId: definition.id,
        deviceId: otherDevice.id,
        requestedBy: otherUserId,
        inputSource: "bench_wizard",
      })
      .returning();
    await app.database.insert(deviceCalibrations).values({
      deviceId: otherDevice.id,
      runId: crossOrganizationRun.id,
      blocks: {},
      approvedBy: otherUserId,
    });
    const resourceIds = [device.id, group.id, definition.id];
    for (const [resourceType, resourceId] of [
      ["device", device.id],
      ["device_group", group.id],
      ["calibration_definition", definition.id],
    ] as const) {
      await app.addResourceGrant({
        resourceType,
        resourceId,
        granteeType: "user",
        granteeId: owner.id,
        role: "admin",
      });
      await app.database
        .insert(resourceVisits)
        .values({ resourceType, resourceId, userId: newcomerId });
    }

    await clearDemoContent(app.database);
    expect(await app.database.select({ id: iotDevices.id }).from(iotDevices)).toEqual([
      { id: otherDevice.id },
    ]);
    expect(
      await app.database.select({ id: calibrationDefinitions.id }).from(calibrationDefinitions),
    ).toEqual([{ id: otherDefinition.id }]);
    expect(await app.database.select({ id: calibrationRuns.id }).from(calibrationRuns)).toEqual([
      { id: otherRun.id },
    ]);
    for (const table of [deviceGroups, deviceCalibrations] as const) {
      expect(await app.database.select({ id: table.id }).from(table)).toHaveLength(0);
    }
    expect(await app.database.select().from(deviceGroupMembers)).toHaveLength(0);
    expect(
      await app.database
        .select()
        .from(resourceGrants)
        .where(inArray(resourceGrants.resourceId, resourceIds)),
    ).toHaveLength(0);
    expect(
      await app.database
        .select()
        .from(resourceVisits)
        .where(inArray(resourceVisits.resourceId, resourceIds)),
    ).toHaveLength(0);
    await seedDemoContent(owner, app.database);
    expect((await graph()).experiments).toHaveLength(3);
  });

  it("rejects a private protocol in the seeded Demo organization", async () => {
    const { owner } = await fixture();
    await expect(
      app.database.insert(protocols).values({
        name: "Private demo protocol",
        family: "multispeq",
        code: [],
        organizationId: DEMO_ORGANIZATION_ID,
        visibility: "private",
        createdBy: owner.id,
      }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("rolls back the whole graph when a later family conflicts", async () => {
    const ownerId = await app.createTestUser();
    const [owner] = await app.database.select().from(users).where(eq(users.id, ownerId));
    await app.database.insert(macros).values({
      name: "Unrelated example",
      filename: "seed_demo_ambit",
      language: "python",
      code: "cmV0dXJuIHt9",
      createdBy: ownerId,
    });
    await expect(seedDemoContent(owner, app.database)).rejects.toThrow();
    for (const values of Object.values(await graph())) expect(values).toHaveLength(0);
    expect(
      await app.database
        .select()
        .from(resourceGrants)
        .where(eq(resourceGrants.granteeId, owner.id)),
    ).toHaveLength(0);
    for (const table of [experiments, workbooks, protocols, macros] as const) {
      expect(
        await app.database
          .select({ id: table.id })
          .from(table)
          .where(
            and(eq(table.organizationId, DEMO_ORGANIZATION_ID), eq(table.visibility, "private")),
          ),
      ).toHaveLength(0);
    }
  });

  it("lets the newcomer read every fixture over HTTP and refuses every mutation", async () => {
    const { owner, newcomerId } = await fixture();
    const before = await graph();
    const listing = await app.get("/api/v1/experiments?scope=all").withAuth(newcomerId).expect(200);
    for (const sensor of DEMO_SEED_FIXTURES) {
      expect(listing.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: sensor.experimentId, organizationType: "demo" }),
        ]),
      );
      for (const path of [
        `/experiments/${sensor.experimentId}`,
        `/workbooks/${sensor.workbookId}`,
        `/workbooks/${sensor.workbookId}/versions/${sensor.versionId}`,
        `/protocols/${sensor.protocolId}`,
        `/macros/${sensor.macroId}`,
        `/experiments/${sensor.experimentId}/dashboards/${sensor.dashboardId}`,
        `/experiments/${sensor.experimentId}/visualizations/${sensor.chartId}`,
      ])
        await app.get(`/api/v1${path}`).withAuth(newcomerId).expect(200);
      for (const path of [
        `/experiments/${sensor.experimentId}`,
        `/workbooks/${sensor.workbookId}`,
        `/protocols/${sensor.protocolId}`,
        `/macros/${sensor.macroId}`,
        `/experiments/${sensor.experimentId}/dashboards/${sensor.dashboardId}`,
        `/experiments/${sensor.experimentId}/visualizations/${sensor.chartId}`,
      ]) {
        const response = await app.delete(`/api/v1${path}`).withAuth(newcomerId);
        expect([403, 404]).toContain(response.status);
      }
    }
    await app
      .post(`/api/v1/organizations/${DEMO_ORGANIZATION_ID}/join-requests`)
      .withAuth(newcomerId)
      .send({})
      .expect(403);
    expect(await graph()).toEqual(before);
    await app
      .patch(`/api/v1/experiments/${DEMO_SEED_FIXTURES[0].experimentId}`)
      .withAuth(owner.id)
      .send({ name: "[Seed] MultispeQ Demo Example Updated" })
      .expect(200);
  });
});
