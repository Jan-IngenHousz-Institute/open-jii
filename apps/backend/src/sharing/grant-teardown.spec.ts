import { and, eq, experimentMembers, resourceGrants, sql } from "@repo/database";

import { assertFailure, assertSuccess } from "../common/utils/fp-utils";
import { ExperimentRepository } from "../experiments/core/repositories/experiment.repository";
import { IotDeviceRepository } from "../iot/core/repositories/iot-device.repository";
import { MacroRepository } from "../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../protocols/core/repositories/protocol.repository";
import { TestHarness } from "../test/test-harness";
import { WorkbookRepository } from "../workbooks/core/repositories/workbook.repository";

/**
 * `resource_grants` is polymorphic, so no FK cascade cleans it up: every delete
 * path must tear down its own grants. Orphaned rows would otherwise linger and
 * could be re-associated with a future resource that reuses the id. Covers every
 * shareable type.
 */
describe("resource grant teardown on resource delete", () => {
  const testApp = TestHarness.App;
  let owner: string;
  let grantee: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    owner = await testApp.createTestUser({ name: "Owner" });
    grantee = await testApp.createTestUser({ name: "Grantee" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  function grantsFor(
    resourceType: "experiment" | "macro" | "protocol" | "workbook" | "device",
    resourceId: string,
  ) {
    return testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, resourceType),
          eq(resourceGrants.resourceId, resourceId),
        ),
      );
  }

  it("deletes a macro's grants along with the macro", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });
    // Only the share above: a creator holds no grant on what they create.
    expect(await grantsFor("macro", macro.id)).toHaveLength(1);

    assertSuccess(await testApp.module.get(MacroRepository).delete(macro.id));

    expect(await grantsFor("macro", macro.id)).toHaveLength(0);
  });

  it("deletes a protocol's grants along with the protocol", async () => {
    const protocol = await testApp.createProtocol({ name: "P", createdBy: owner });
    await testApp.addResourceGrant({
      resourceType: "protocol",
      resourceId: protocol.id,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });
    // Only the share above: a creator holds no grant on what they create.
    expect(await grantsFor("protocol", protocol.id)).toHaveLength(1);

    assertSuccess(await testApp.module.get(ProtocolRepository).delete(protocol.id));

    expect(await grantsFor("protocol", protocol.id)).toHaveLength(0);
  });

  it("deletes a workbook's grants along with the workbook", async () => {
    const workbook = await testApp.createWorkbook({ name: "W", createdBy: owner });
    await testApp.addResourceGrant({
      resourceType: "workbook",
      resourceId: workbook.id,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });
    // Only the share above: a creator holds no grant on what they create.
    expect(await grantsFor("workbook", workbook.id)).toHaveLength(1);

    assertSuccess(await testApp.module.get(WorkbookRepository).delete(workbook.id));

    expect(await grantsFor("workbook", workbook.id)).toHaveLength(0);
  });

  it("deletes a device's grants along with the device", async () => {
    const device = await testApp.createIotDevice({ createdBy: owner });
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: device.id,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });
    // Only the share above: a creator holds no grant on what they create.
    expect(await grantsFor("device", device.id)).toHaveLength(1);

    // Straight to the repository: the use case would call AWS to tear down the
    // Thing and its certificate first, which is not what this is about.
    assertSuccess(await testApp.module.get(IotDeviceRepository).delete(device.id));

    expect(await grantsFor("device", device.id)).toHaveLength(0);
  });

  it("deletes every grant on an experiment along with it", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID()}`,
      userId: owner,
    });
    // The creator holds no grant, so the only row is this direct share.
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: grantee,
      role: "admin",
    });
    const before = await grantsFor("experiment", experiment.id);
    expect(before.map((g) => g.granteeId)).toEqual([grantee]);

    assertSuccess(await testApp.module.get(ExperimentRepository).delete(experiment.id));

    expect(await grantsFor("experiment", experiment.id)).toHaveLength(0);
  });

  it("leaves other resources' grants untouched", async () => {
    const doomed = await testApp.createMacro({ name: "Doomed", createdBy: owner });
    const survivor = await testApp.createMacro({ name: "Survivor", createdBy: owner });
    for (const id of [doomed.id, survivor.id]) {
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
      });
    }

    assertSuccess(await testApp.module.get(MacroRepository).delete(doomed.id));

    expect(await grantsFor("macro", doomed.id)).toHaveLength(0);
    // The survivor keeps its share.
    expect(await grantsFor("macro", survivor.id)).toHaveLength(1);
  });

  /**
   * Cleanup and the resource delete must be ONE transaction. Otherwise a delete
   * that fails after the cleanup committed leaves the resource alive with every
   * grant on it already gone — collaborators silently lose access while the API
   * reports failure. Each case forces the resource delete to fail *inside* the
   * transaction (a BEFORE DELETE trigger that raises) and asserts the grants
   * survived, which only holds if the whole unit rolled back.
   */
  describe("atomicity: a failed resource delete rolls the grant cleanup back", () => {
    /** Run `fn` while deletes on `table` raise, always dropping the trigger after. */
    async function withDeleteBlocked(table: string, fn: () => Promise<void>) {
      const triggerName = `test_block_delete_${table}`;
      await testApp.database.execute(sql`
        CREATE OR REPLACE FUNCTION test_block_delete() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'delete blocked by test'; END;
        $$ LANGUAGE plpgsql;
      `);
      await testApp.database.execute(
        sql`CREATE TRIGGER ${sql.raw(triggerName)} BEFORE DELETE ON ${sql.raw(table)}
            FOR EACH ROW EXECUTE FUNCTION test_block_delete();`,
      );
      try {
        await fn();
      } finally {
        // Must always drop it: the trigger would otherwise block the harness's
        // own between-test cleanup for every later test in this file.
        await testApp.database.execute(
          sql`DROP TRIGGER IF EXISTS ${sql.raw(triggerName)} ON ${sql.raw(table)};`,
        );
      }
    }

    it("keeps a macro's grants when the macro delete fails", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
      });

      await withDeleteBlocked("macros", async () => {
        const result = await testApp.module.get(MacroRepository).delete(macro.id);
        assertFailure(result);

        expect(await grantsFor("macro", macro.id)).toHaveLength(1);
      });
    });

    it("keeps a protocol's grants when the protocol delete fails", async () => {
      const protocol = await testApp.createProtocol({ name: "P", createdBy: owner });
      await testApp.addResourceGrant({
        resourceType: "protocol",
        resourceId: protocol.id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
      });

      await withDeleteBlocked("protocols", async () => {
        const result = await testApp.module.get(ProtocolRepository).delete(protocol.id);
        assertFailure(result);

        expect(await grantsFor("protocol", protocol.id)).toHaveLength(1);
      });
    });

    it("keeps a workbook's grants when the workbook delete fails", async () => {
      const workbook = await testApp.createWorkbook({ name: "W", createdBy: owner });
      await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: workbook.id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
      });

      await withDeleteBlocked("workbooks", async () => {
        const result = await testApp.module.get(WorkbookRepository).delete(workbook.id);
        assertFailure(result);

        expect(await grantsFor("workbook", workbook.id)).toHaveLength(1);
      });
    });

    it("keeps a device's grants when the device delete fails", async () => {
      const device = await testApp.createIotDevice({ createdBy: owner });
      await testApp.addResourceGrant({
        resourceType: "device",
        resourceId: device.id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
      });

      await withDeleteBlocked("iot_devices", async () => {
        const result = await testApp.module.get(IotDeviceRepository).delete(device.id);
        assertFailure(result);

        expect(await grantsFor("device", device.id)).toHaveLength(1);
      });
    });

    it("keeps an experiment's grants and dormant roster rows when the delete fails", async () => {
      const { experiment } = await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: owner,
      });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: grantee,
        role: "admin",
      });
      // A leftover row in the dormant roster table: nothing writes it any more,
      // but rows predating the consolidation still hold an FK to the experiment,
      // so the delete path clears them and that clearing must roll back too.
      await testApp.database
        .insert(experimentMembers)
        .values({ experimentId: experiment.id, userId: owner });
      // Just the share above — creators hold no grant.
      const grantsBefore = await grantsFor("experiment", experiment.id);
      expect(grantsBefore).toHaveLength(1);

      await withDeleteBlocked("experiments", async () => {
        const result = await testApp.module.get(ExperimentRepository).delete(experiment.id);
        assertFailure(result);

        expect(await grantsFor("experiment", experiment.id)).toHaveLength(1);
        const members = await testApp.database
          .select()
          .from(experimentMembers)
          .where(eq(experimentMembers.experimentId, experiment.id));
        expect(members).toHaveLength(1);
      });
    });
  });
});
