import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ListWorkbooksUseCase } from "./list-workbooks";

describe("ListWorkbooksUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListWorkbooksUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListWorkbooksUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns empty list when no workbooks exist", async () => {
    const result = await useCase.execute();
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("returns all workbooks", async () => {
    await testApp.createWorkbook({ name: "WB 1", createdBy: userId });
    await testApp.createWorkbook({ name: "WB 2", createdBy: userId });
    const result = await useCase.execute();
    assertSuccess(result);
    expect(result.value).toHaveLength(2);
  });

  it("filters by search term", async () => {
    await testApp.createWorkbook({ name: "Alpha Workbook", createdBy: userId });
    await testApp.createWorkbook({ name: "Beta Workbook", createdBy: userId });
    const result = await useCase.execute({ search: "Alpha" });
    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].name).toBe("Alpha Workbook");
  });

  it("filters by 'my' to show only user's workbooks", async () => {
    const otherUser = await testApp.createTestUser({});
    await testApp.createWorkbook({ name: "Mine", createdBy: userId });
    await testApp.createWorkbook({ name: "Theirs", createdBy: otherUser });
    const result = await useCase.execute({ filter: "my", userId });
    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].name).toBe("Mine");
  });

  it("returns workbooks sorted by name", async () => {
    await testApp.createWorkbook({ name: "Charlie", createdBy: userId });
    await testApp.createWorkbook({ name: "Alpha", createdBy: userId });
    await testApp.createWorkbook({ name: "Bravo", createdBy: userId });
    const result = await useCase.execute();
    assertSuccess(result);
    expect(result.value.map((w) => w.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});
