import { eq, experiments } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { WorkbookRepository } from "./workbook.repository";

describe("WorkbookRepository", () => {
  const testApp = TestHarness.App;
  let repository: WorkbookRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(WorkbookRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const searchWorkbooks = async (query: string, asUser: string = testUserId) => {
    const result = await repository.findAll({ search: query, userId: asUser }, 20);
    assertSuccess(result);
    return result.value.map((workbook) => workbook.name);
  };

  describe("findAll search coverage", () => {
    it("matches the name", async () => {
      await testApp.createWorkbook({
        name: "Calibration helper workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("calibration")).toContain("Calibration helper workbook");
    });

    it("matches the description", async () => {
      await testApp.createWorkbook({
        name: "Snarf notebook",
        description: "computes transpiration index",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("transpiration")).toContain("Snarf notebook");
    });

    it("matches the creator's name", async () => {
      const creator = await testApp.createTestUser({ name: "Ada Lovelace" });
      await testApp.createWorkbook({ name: "Blorp analysis", createdBy: creator });

      expect(await searchWorkbooks("lovelace")).toContain("Blorp analysis");
    });

    it("ranks a name match above a creator-only match", async () => {
      const creator = await testApp.createTestUser({ name: "Photosynthesis Researcher" });
      await testApp.createWorkbook({
        name: "Photosynthesis workbook",
        createdBy: testUserId,
      });
      await testApp.createWorkbook({ name: "Maize field notebook", createdBy: creator });

      const names = await searchWorkbooks("photosynthesis");

      expect(names).toContain("Photosynthesis workbook");
      expect(names).toContain("Maize field notebook");
      expect(names.indexOf("Photosynthesis workbook")).toBeLessThan(
        names.indexOf("Maize field notebook"),
      );
    });

    it("matches a linked experiment's name", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Trellis notebook",
        createdBy: testUserId,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Orbitron canopy trial",
        userId: testUserId,
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("orbitron")).toContain("Trellis notebook");
    });

    it("matches a linked experiment's description", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Brindle notebook",
        createdBy: testUserId,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Fallow field trial",
        description: "quantifies evapotranspiration across plots",
        userId: testUserId,
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("evapotranspiration")).toContain("Brindle notebook");
    });

    it("does not match a linked private experiment the requesting user cannot access", async () => {
      const otherUser = await testApp.createTestUser({});
      const workbook = await testApp.createWorkbook({
        name: "Sable notebook",
        createdBy: otherUser,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Confidential xenobotany trial",
        userId: otherUser,
        visibility: "private",
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("xenobotany")).not.toContain("Sable notebook");
    });

    it("matches a linked public experiment owned by another user", async () => {
      const otherUser = await testApp.createTestUser({});
      const workbook = await testApp.createWorkbook({
        name: "Topaz notebook",
        createdBy: otherUser,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Open heliotropism trial",
        userId: otherUser,
        visibility: "public",
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("heliotropism")).toContain("Topaz notebook");
    });

    it("does not match an archived linked experiment", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Umber notebook",
        createdBy: testUserId,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Obsolete gravitropism trial",
        userId: testUserId,
        status: "archived",
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("gravitropism")).not.toContain("Umber notebook");
    });

    it("matches a linked protocol's name (via a cell reference, using the live name)", async () => {
      const protocol = await testApp.createProtocol({
        name: "Chlorophyll fluorometry",
        createdBy: testUserId,
      });
      // Cell references the protocol by id only (no payload.name) — the match must come from the
      // live protocol row, and the workbook name deliberately shares no term with it.
      await testApp.createWorkbook({
        name: "Zephyr notebook",
        createdBy: testUserId,
        cells: [
          { id: "cell-1", type: "protocol", payload: { protocolId: protocol.id, version: 1 } },
        ],
      });

      expect(await searchWorkbooks("chlorophyll")).toContain("Zephyr notebook");
    });

    it("matches a linked macro's name (via a cell reference, using the live name)", async () => {
      const macro = await testApp.createMacro({
        name: "Voronoi tessellation",
        createdBy: testUserId,
      });
      await testApp.createWorkbook({
        name: "Quill notebook",
        createdBy: testUserId,
        cells: [
          { id: "cell-1", type: "macro", payload: { macroId: macro.id, language: "python" } },
        ],
      });

      expect(await searchWorkbooks("voronoi")).toContain("Quill notebook");
    });

    it("does not match a stale/label payload.name that differs from the live entity name", async () => {
      const protocol = await testApp.createProtocol({
        name: "Actual protocol name",
        createdBy: testUserId,
      });
      // The cell carries a stale label; searching it must NOT surface the workbook (we match live).
      await testApp.createWorkbook({
        name: "Cobalt notebook",
        createdBy: testUserId,
        cells: [
          {
            id: "cell-1",
            type: "protocol",
            payload: { protocolId: protocol.id, version: 1, name: "Stalelabelxyz" },
          },
        ],
      });

      expect(await searchWorkbooks("stalelabelxyz")).not.toContain("Cobalt notebook");
      expect(await searchWorkbooks("actual protocol name")).toContain("Cobalt notebook");
    });

    it("does prefix matching", async () => {
      await testApp.createWorkbook({
        name: "Spectral analysis workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("spectr")).toContain("Spectral analysis workbook");
    });

    it("matches names case-insensitively", async () => {
      await testApp.createWorkbook({
        name: "Casefold Canopy Workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("CASEFOLD")).toContain("Casefold Canopy Workbook");
    });

    it("does stemming", async () => {
      await testApp.createWorkbook({
        name: "Running average workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("run")).toContain("Running average workbook");
    });

    it("tolerates a typo via trigram matching", async () => {
      await testApp.createWorkbook({ name: "Bioluminescence", createdBy: testUserId });

      expect(await searchWorkbooks("bioluminecence")).toContain("Bioluminescence");
    });

    it("matches names containing punctuation", async () => {
      await testApp.createWorkbook({
        name: "Ridge-01 canopy workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("ridge-01")).toContain("Ridge-01 canopy workbook");
    });

    it("excludes a deactivated creator from name matching", async () => {
      const ghost = await testApp.createTestUser({ name: "Calib Specter", activated: false });
      await testApp.createWorkbook({ name: "Hidden ledger", createdBy: ghost });

      expect(await searchWorkbooks("specter")).not.toContain("Hidden ledger");
    });

    it("excludes a soft-deleted creator from name matching", async () => {
      const deletedCreator = await testApp.createTestUser({
        name: "Removed Researcher",
        deletedAt: new Date(),
      });
      await testApp.createWorkbook({ name: "Ordinary notebook", createdBy: deletedCreator });

      expect(await searchWorkbooks("researcher")).not.toContain("Ordinary notebook");
    });

    it("respects the requested search result limit", async () => {
      for (const suffix of ["Alpha", "Bravo", "Charlie"]) {
        await testApp.createWorkbook({
          name: `Limitprobe ${suffix}`,
          createdBy: testUserId,
        });
      }

      const result = await repository.findAll({ search: "limitprobe", userId: testUserId }, 2);

      assertSuccess(result);
      expect(result.value).toHaveLength(2);
    });
  });
});
