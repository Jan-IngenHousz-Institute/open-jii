import { eq, experiments } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GlobalSearchUseCase } from "./global-search";

describe("GlobalSearchUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GlobalSearchUseCase;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    otherUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GlobalSearchUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns ranked matches across experiments, protocols, macros and workbooks", async () => {
    await testApp.createExperiment({
      name: "Photosynthesis trial",
      userId,
      visibility: "public",
    });
    await testApp.createProtocol({ name: "Photosynthesis protocol", createdBy: userId });
    await testApp.createMacro({ name: "Photosynthesis macro", createdBy: userId });
    await testApp.createWorkbook({ name: "Photosynthesis workbook", createdBy: userId });

    const result = await useCase.execute(userId, "photosynthesis", 20);

    assertSuccess(result);
    const types = result.value.results.map((r) => r.type);
    expect(types).toContain("experiment");
    expect(types).toContain("protocol");
    expect(types).toContain("macro");
    expect(types).toContain("workbook");
    // The workbook result carries no type-specific meta label (like experiments).
    const workbook = result.value.results.find((r) => r.type === "workbook");
    expect(workbook?.title).toBe("Photosynthesis workbook");
    expect(workbook?.meta).toBeNull();
  });

  it("matches description text (FTS) and tolerates typos in the name (trigram)", async () => {
    await testApp.createProtocol({
      name: "Bioluminescence",
      description: "quantifies chlorophyll fluorescence",
      createdBy: userId,
    });

    // Description word, matched through the weighted full-text vector.
    const byDescription = await useCase.execute(userId, "chlorophyll", 20);
    assertSuccess(byDescription);
    expect(byDescription.value.results.some((r) => r.title === "Bioluminescence")).toBe(true);

    // Misspelled name ("bioluminecence" — missing an 's'), matched through trigram similarity.
    const byTypo = await useCase.execute(userId, "bioluminecence", 20);
    assertSuccess(byTypo);
    expect(byTypo.value.results.some((r) => r.title === "Bioluminescence")).toBe(true);
  });

  it("finds names containing punctuation (hyphens/colons) via the literal substring fallback", async () => {
    // FTS sanitizes "ridge-01" to "ridge01" (misses the stored 'ridg'+'-01' lexemes) and the long
    // name keeps trigram similarity below threshold — only the substring ILIKE branch catches it.
    await testApp.createProtocol({
      name: "Ridge-01 canopy reflectance measurement protocol",
      createdBy: userId,
    });

    const result = await useCase.execute(userId, "ridge-01", 20);

    assertSuccess(result);
    expect(
      result.value.results.some(
        (r) => r.title === "Ridge-01 canopy reflectance measurement protocol",
      ),
    ).toBe(true);
  });

  it("matches the macro language and protocol family enums (parity with focused search)", async () => {
    // Names/descriptions deliberately omit the enum value — only the enum should match.
    await testApp.createMacro({ name: "Data analysis", language: "python", createdBy: userId });
    await testApp.createProtocol({ name: "Leaf scan", family: "multispeq", createdBy: userId });

    const byLanguage = await useCase.execute(userId, "python", 20);
    assertSuccess(byLanguage);
    const macro = byLanguage.value.results.find((r) => r.title === "Data analysis");
    expect(macro?.meta).toBe("python");

    const byFamily = await useCase.execute(userId, "multispeq", 20);
    assertSuccess(byFamily);
    const protocol = byFamily.value.results.find((r) => r.title === "Leaf scan");
    expect(protocol?.meta).toBe("multispeq");
  });

  it("finds a workbook through a linked private experiment the user can access", async () => {
    const workbook = await testApp.createWorkbook({
      name: "Trellis notebook",
      createdBy: userId,
    });
    const { experiment } = await testApp.createExperiment({
      name: "Orbitron canopy trial",
      userId,
      visibility: "private",
    });
    await testApp.database
      .update(experiments)
      .set({ workbookId: workbook.id })
      .where(eq(experiments.id, experiment.id));

    const result = await useCase.execute(userId, "orbitron", 20);

    assertSuccess(result);
    expect(
      result.value.results.some(
        (searchResult) =>
          searchResult.type === "workbook" && searchResult.title === "Trellis notebook",
      ),
    ).toBe(true);
  });

  it("finds a workbook through a linked protocol or macro name in its cells", async () => {
    const protocol = await testApp.createProtocol({
      name: "Zorptastic fluorometry",
      createdBy: userId,
    });
    const macro = await testApp.createMacro({ name: "Wibblonian transform", createdBy: userId });
    await testApp.createWorkbook({
      name: "Plain notebook A",
      createdBy: userId,
      cells: [{ id: "c1", type: "protocol", payload: { protocolId: protocol.id, version: 1 } }],
    });
    await testApp.createWorkbook({
      name: "Plain notebook B",
      createdBy: userId,
      cells: [{ id: "c1", type: "macro", payload: { macroId: macro.id, language: "python" } }],
    });

    const byProtocol = await useCase.execute(userId, "zorptastic", 20);
    assertSuccess(byProtocol);
    expect(
      byProtocol.value.results.some((r) => r.type === "workbook" && r.title === "Plain notebook A"),
    ).toBe(true);

    const byMacro = await useCase.execute(userId, "wibblonian", 20);
    assertSuccess(byMacro);
    expect(
      byMacro.value.results.some((r) => r.type === "workbook" && r.title === "Plain notebook B"),
    ).toBe(true);
  });

  it("excludes private experiments the requesting user cannot access", async () => {
    await testApp.createExperiment({
      name: "Secret photosynthesis study",
      userId: otherUserId,
      visibility: "private",
    });

    const result = await useCase.execute(userId, "photosynthesis", 20);

    assertSuccess(result);
    expect(result.value.results.some((r) => r.title === "Secret photosynthesis study")).toBe(false);
  });

  it("includes public experiments created by other users", async () => {
    await testApp.createExperiment({
      name: "Open photosynthesis study",
      userId: otherUserId,
      visibility: "public",
    });

    const result = await useCase.execute(userId, "photosynthesis", 20);

    assertSuccess(result);
    expect(result.value.results.some((r) => r.title === "Open photosynthesis study")).toBe(true);
  });

  // Cross-type order is one comparable score, not a round-robin over types.
  describe("cross-type ranking", () => {
    it("ranks an exact name match above weaker matches of other types", async () => {
      await testApp.createMacro({
        name: "Helper utilities",
        description: "supporting zephyrine calculations",
        createdBy: userId,
      });
      await testApp.createProtocol({
        name: "Field routine",
        description: "records zephyrine readings",
        createdBy: userId,
      });
      await testApp.createExperiment({ name: "Zephyrine", userId, visibility: "public" });

      const result = await useCase.execute(userId, "zephyrine", 20);

      assertSuccess(result);
      // The experiment wins on its name hit, not because experiments are listed first.
      expect(result.value.results[0].title).toBe("Zephyrine");
      expect(result.value.results[0].type).toBe("experiment");
    });

    it("lets one type take more than its share when it holds the best matches", async () => {
      for (let i = 0; i < 10; i++) {
        await testApp.createProtocol({ name: `Vorbulon protocol ${i}`, createdBy: userId });
      }
      await testApp.createMacro({
        name: "Unrelated macro",
        description: "mentions vorbulon in passing",
        createdBy: userId,
      });

      const result = await useCase.execute(userId, "vorbulon", 8);

      assertSuccess(result);
      // The old fan-out capped every type at 8; overfetching removes that ceiling, so a
      // limit of 8 can now be filled entirely from the type that matched best.
      expect(result.value.results).toHaveLength(8);
      expect(result.value.results.every((r) => r.type === "protocol")).toBe(true);
    });

    it("orders results by descending score", async () => {
      await testApp.createExperiment({ name: "Grindelwax", userId, visibility: "public" });
      await testApp.createProtocol({
        name: "Grindelwax assay",
        createdBy: userId,
      });
      await testApp.createMacro({
        name: "Unrelated helper",
        description: "grindelwax post-processing",
        createdBy: userId,
      });

      const result = await useCase.execute(userId, "grindelwax", 20);

      assertSuccess(result);
      const titles = result.value.results.map((r) => r.title);
      expect(titles).toContain("Grindelwax");
      expect(titles).toContain("Grindelwax assay");
      // A description-only hit ranks below both name hits regardless of its type.
      expect(titles.indexOf("Unrelated helper")).toBeGreaterThan(titles.indexOf("Grindelwax"));
      expect(titles.indexOf("Unrelated helper")).toBeGreaterThan(
        titles.indexOf("Grindelwax assay"),
      );
    });
  });

  // Global search delegates to the same per-type findAlls, so their access scoping
  // applies here too: a private macro/protocol/workbook is undiscoverable to a
  // non-grantee but visible once a grant is held.
  describe("private macro/protocol/workbook scoping", () => {
    it("hides private macro/protocol/workbook from a non-grantee", async () => {
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, otherUserId, "owner");
      await testApp.createMacro({
        name: "Hidden photosynthesis macro",
        createdBy: otherUserId,
        visibility: "private",
        organizationId: orgId,
      });
      await testApp.createProtocol({
        name: "Hidden photosynthesis protocol",
        createdBy: otherUserId,
        visibility: "private",
        organizationId: orgId,
      });
      await testApp.createWorkbook({
        name: "Hidden photosynthesis workbook",
        createdBy: otherUserId,
        visibility: "private",
        organizationId: orgId,
      });

      const result = await useCase.execute(userId, "photosynthesis", 20);

      assertSuccess(result);
      const titles = result.value.results.map((r) => r.title);
      expect(titles).not.toContain("Hidden photosynthesis macro");
      expect(titles).not.toContain("Hidden photosynthesis protocol");
      expect(titles).not.toContain("Hidden photosynthesis workbook");
    });

    it("shows a private macro/protocol/workbook to a grantee", async () => {
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, otherUserId, "owner");
      const macro = await testApp.createMacro({
        name: "Shared photosynthesis macro",
        createdBy: otherUserId,
        visibility: "private",
        organizationId: orgId,
      });
      const protocol = await testApp.createProtocol({
        name: "Shared photosynthesis protocol",
        createdBy: otherUserId,
        visibility: "private",
        organizationId: orgId,
      });
      const workbook = await testApp.createWorkbook({
        name: "Shared photosynthesis workbook",
        createdBy: otherUserId,
        visibility: "private",
        organizationId: orgId,
      });
      for (const [resourceType, resourceId] of [
        ["macro", macro.id],
        ["protocol", protocol.id],
        ["workbook", workbook.id],
      ] as const) {
        await testApp.addResourceGrant({
          resourceType,
          resourceId,
          granteeType: "user",
          granteeId: userId,
          role: "viewer",
        });
      }

      const result = await useCase.execute(userId, "photosynthesis", 20);

      assertSuccess(result);
      const titles = result.value.results.map((r) => r.title);
      expect(titles).toContain("Shared photosynthesis macro");
      expect(titles).toContain("Shared photosynthesis protocol");
      expect(titles).toContain("Shared photosynthesis workbook");
    });
  });
});
