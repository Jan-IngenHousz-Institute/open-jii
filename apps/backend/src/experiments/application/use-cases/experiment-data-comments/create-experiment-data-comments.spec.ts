import type { CreateExperimentDataComments } from "@repo/api";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CreateExperimentDataCommentsUseCase } from "./create-experiment-data-comments";

describe("CreateExperimentDataCommentsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentDataCommentsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentDataCommentsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create comments for experiment data successfully", async () => {
    const experimentId = "test-experiment-id";
    const tableName = "test-table";
    const newComment: CreateExperimentDataComments = {
      rowIds: ["row1", "row2"],
      text: "Test comment",
    };

    const result = await useCase.execute(experimentId, tableName, testUserId, newComment);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
