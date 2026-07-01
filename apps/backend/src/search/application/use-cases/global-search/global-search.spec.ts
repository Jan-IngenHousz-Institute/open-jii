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

  it("returns ranked matches across experiments, protocols and macros", async () => {
    await testApp.createExperiment({
      name: "Photosynthesis trial",
      userId,
      visibility: "public",
    });
    await testApp.createProtocol({ name: "Photosynthesis protocol", createdBy: userId });
    await testApp.createMacro({ name: "Photosynthesis macro", createdBy: userId });

    const result = await useCase.execute(userId, "photosynthesis", 20);

    assertSuccess(result);
    const types = result.value.results.map((r) => r.type);
    expect(types).toContain("experiment");
    expect(types).toContain("protocol");
    expect(types).toContain("macro");
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
