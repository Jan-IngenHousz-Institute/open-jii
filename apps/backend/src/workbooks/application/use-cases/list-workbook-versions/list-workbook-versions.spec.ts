import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { ListWorkbookVersionsUseCase } from "./list-workbook-versions";

describe("ListWorkbookVersionsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListWorkbookVersionsUseCase;
  let versionRepo: WorkbookVersionRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListWorkbookVersionsUseCase);
    versionRepo = testApp.module.get(WorkbookVersionRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns empty array for a workbook with no versions", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB1", createdBy: userId });
    const result = await useCase.execute(workbook.id);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("returns versions ordered by version descending", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB2", createdBy: userId });

    await versionRepo.create({
      workbookId: workbook.id,
      version: 1,
      cells: [],
      metadata: {},
      createdBy: userId,
    });

    await versionRepo.create({
      workbookId: workbook.id,
      version: 2,
      cells: [{ id: "md1", type: "markdown", content: "v2" }],
      metadata: {},
      createdBy: userId,
    });

    const result = await useCase.execute(workbook.id);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);
    expect(result.value[0].version).toBe(2);
    expect(result.value[1].version).toBe(1);
  });

  it("returns empty array for a non-existent workbook id", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000");
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
