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
});
