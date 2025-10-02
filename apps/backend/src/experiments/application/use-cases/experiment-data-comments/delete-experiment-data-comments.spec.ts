import type { DeleteExperimentDataComments } from "@repo/api";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DeleteExperimentDataCommentsUseCase } from "./delete-experiment-data-comments";

describe("DeleteExperimentDataCommentsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentDataCommentsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentDataCommentsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete comments for experiment data successfully", async () => {
    const experimentId = "test-experiment-id";
    const tableName = "test-table";
    const deleteComment: DeleteExperimentDataComments = {
      type: "comment",
      rowIds: ["row1", "row2"],
    };

    const result = await useCase.execute(experimentId, tableName, testUserId, deleteComment);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
  });
});
