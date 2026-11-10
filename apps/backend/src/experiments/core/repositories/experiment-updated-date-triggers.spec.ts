import {
  eq,
  experimentDashboards,
  experimentDevices,
  experimentLocations,
  experimentMembers,
  experimentVisualizations,
  experiments,
  flows,
  iotDevices,
  resourceGrants,
} from "@repo/database";

import { TestHarness } from "../../../test/test-harness";

describe("experiment updated date triggers", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let otherUserId: string;
  let experimentId: string;

  const oldDate = new Date("2020-01-01T00:00:00.000Z");

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Trigger Owner" });
    otherUserId = await testApp.createTestUser({ name: "Other Member" });
    const created = await testApp.createExperiment({ name: "Trigger Test", userId });
    experimentId = created.experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function setExperimentDate(date: Date) {
    await testApp.database
      .update(experiments)
      .set({ updatedAt: date })
      .where(eq(experiments.id, experimentId));
  }

  async function experimentDate(): Promise<Date | undefined> {
    const rows = await testApp.database
      .select({ updatedAt: experiments.updatedAt })
      .from(experiments)
      .where(eq(experiments.id, experimentId));
    return rows.length === 0 ? undefined : rows[0].updatedAt;
  }

  async function expectTouched() {
    const updatedAt = await experimentDate();
    if (!updatedAt) {
      throw new Error("Experiment should still exist after a child write");
    }
    expect(updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
  }

  const childTables = [
    {
      name: "experiment_dashboards",
      insert: async () => {
        const [row] = await testApp.database
          .insert(experimentDashboards)
          .values({ experimentId, name: "Dashboard", createdBy: userId })
          .returning();
        return row.id;
      },
      update: async (id: string) => {
        await testApp.database
          .update(experimentDashboards)
          .set({ name: "Updated dashboard" })
          .where(eq(experimentDashboards.id, id));
      },
      delete: async (id: string) => {
        await testApp.database.delete(experimentDashboards).where(eq(experimentDashboards.id, id));
      },
    },
    {
      name: "experiment_visualizations",
      insert: async () => {
        const [row] = await testApp.database
          .insert(experimentVisualizations)
          .values({
            experimentId,
            name: "Visualization",
            chartFamily: "basic",
            chartType: "bar",
            config: {},
            dataConfig: {},
            createdBy: userId,
          })
          .returning();
        return row.id;
      },
      update: async (id: string) => {
        await testApp.database
          .update(experimentVisualizations)
          .set({ name: "Updated visualization" })
          .where(eq(experimentVisualizations.id, id));
      },
      delete: async (id: string) => {
        await testApp.database
          .delete(experimentVisualizations)
          .where(eq(experimentVisualizations.id, id));
      },
    },
    {
      name: "experiment_locations",
      insert: async () => {
        const [row] = await testApp.database
          .insert(experimentLocations)
          .values({ experimentId, name: "Field", latitude: "1", longitude: "2" })
          .returning();
        return row.id;
      },
      update: async (id: string) => {
        await testApp.database
          .update(experimentLocations)
          .set({ name: "Updated field" })
          .where(eq(experimentLocations.id, id));
      },
      delete: async (id: string) => {
        await testApp.database.delete(experimentLocations).where(eq(experimentLocations.id, id));
      },
    },
    {
      name: "flows",
      insert: async () => {
        const [row] = await testApp.database
          .insert(flows)
          .values({ experimentId, graph: {} })
          .returning();
        return row.id;
      },
      update: async (id: string) => {
        await testApp.database
          .update(flows)
          .set({ graph: { changed: true } })
          .where(eq(flows.id, id));
      },
      delete: async (id: string) => {
        await testApp.database.delete(flows).where(eq(flows.id, id));
      },
    },
  ];

  describe.each(childTables)("$name", ({ insert, update, delete: deleteRow }) => {
    it("touches the experiment after insert, update and delete", async () => {
      await setExperimentDate(oldDate);
      const id = await insert();
      await expectTouched();

      await setExperimentDate(oldDate);
      await update(id);
      await expectTouched();

      await setExperimentDate(oldDate);
      await deleteRow(id);
      await expectTouched();
    });
  });

  describe("experiment_devices", () => {
    async function createDevice() {
      const [device] = await testApp.database
        .insert(iotDevices)
        .values({
          thingName: `trigger-device-${crypto.randomUUID()}`,
          thingArn: "arn:aws:iot:us-east-1:123456789012:thing/trigger-test",
          serialNumber: crypto.randomUUID(),
          deviceType: "generic",
          createdBy: userId,
        })
        .returning();
      return device.id;
    }

    it("touches the experiment after binding insert, update and delete", async () => {
      const deviceId = await createDevice();
      await setExperimentDate(oldDate);
      await testApp.database.insert(experimentDevices).values({
        experimentId,
        deviceId,
        addedBy: userId,
      });
      await expectTouched();

      await setExperimentDate(oldDate);
      await testApp.database
        .update(experimentDevices)
        .set({ updatedAt: new Date() })
        .where(eq(experimentDevices.experimentId, experimentId));
      await expectTouched();

      await setExperimentDate(oldDate);
      await testApp.database
        .delete(experimentDevices)
        .where(eq(experimentDevices.experimentId, experimentId));
      await expectTouched();
    });

    it("touches each experiment when device deletion cascades its bindings", async () => {
      const secondExperiment = await testApp.createExperiment({
        name: "Second Trigger Test",
        userId,
      });
      const deviceId = await createDevice();
      await testApp.database.insert(experimentDevices).values([
        { experimentId, deviceId, addedBy: userId },
        { experimentId: secondExperiment.experiment.id, deviceId, addedBy: userId },
      ]);
      await setExperimentDate(oldDate);
      await testApp.database
        .update(experiments)
        .set({ updatedAt: oldDate })
        .where(eq(experiments.id, secondExperiment.experiment.id));

      await testApp.database.delete(iotDevices).where(eq(iotDevices.id, deviceId));

      await expectTouched();
      const [second] = await testApp.database
        .select({ updatedAt: experiments.updatedAt })
        .from(experiments)
        .where(eq(experiments.id, secondExperiment.experiment.id));
      expect(second.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });
  });

  it("does not bump again while the last update is inside the five minute window", async () => {
    const recent = new Date(Date.now() - 4 * 60 * 1000);
    await setExperimentDate(recent);

    await testApp.database
      .insert(experimentDashboards)
      .values({ experimentId, name: "Recent save", createdBy: userId });

    expect((await experimentDate())?.getTime()).toBe(recent.getTime());
  });

  it("bumps after the five minute window has elapsed", async () => {
    await setExperimentDate(new Date(Date.now() - 6 * 60 * 1000));

    await testApp.database
      .insert(experimentDashboards)
      .values({ experimentId, name: "Old save", createdBy: userId });

    await expectTouched();
  });

  it("rolls the experiment date back when the child write transaction fails", async () => {
    await setExperimentDate(oldDate);

    await expect(
      testApp.database.transaction(async (tx) => {
        await tx.insert(experimentDashboards).values({
          experimentId,
          name: "Rolled back dashboard",
          createdBy: userId,
        });
        const [insideTransaction] = await tx
          .select({ updatedAt: experiments.updatedAt })
          .from(experiments)
          .where(eq(experiments.id, experimentId));
        expect(insideTransaction.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
        throw new Error("rollback test");
      }),
    ).rejects.toThrow("rollback test");

    expect((await experimentDate())?.getTime()).toBe(oldDate.getTime());
    const dashboards = await testApp.database
      .select()
      .from(experimentDashboards)
      .where(eq(experimentDashboards.experimentId, experimentId));
    expect(dashboards).toHaveLength(0);
  });

  it("allows child triggers to run during experiment deletion cascades", async () => {
    await testApp.database
      .insert(experimentDashboards)
      .values({ experimentId, name: "Delete parent", createdBy: userId });

    await testApp.database.delete(experiments).where(eq(experiments.id, experimentId));
    expect(await experimentDate()).toBeUndefined();
    expect(
      await testApp.database
        .select()
        .from(experimentDashboards)
        .where(eq(experimentDashboards.experimentId, experimentId)),
    ).toHaveLength(0);
  });

  it("leaves membership and resource access changes outside the trigger scope", async () => {
    await setExperimentDate(oldDate);
    await testApp.database.insert(experimentMembers).values({
      experimentId,
      userId: otherUserId,
      role: "member",
    });
    await testApp.database.insert(resourceGrants).values({
      resourceType: "experiment",
      resourceId: experimentId,
      granteeType: "user",
      granteeId: otherUserId,
      role: "viewer",
      createdBy: userId,
    });

    await testApp.database
      .update(experimentMembers)
      .set({ role: "admin" })
      .where(eq(experimentMembers.experimentId, experimentId));
    await testApp.database
      .update(resourceGrants)
      .set({ role: "admin" })
      .where(eq(resourceGrants.resourceId, experimentId));

    await testApp.database
      .delete(experimentMembers)
      .where(eq(experimentMembers.experimentId, experimentId));
    await testApp.database
      .delete(resourceGrants)
      .where(eq(resourceGrants.resourceId, experimentId));

    expect((await experimentDate())?.getTime()).toBe(oldDate.getTime());
  });
});
