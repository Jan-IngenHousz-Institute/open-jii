import { assertFailure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ListExperimentJoinRequestsUseCase } from "./list-experiment-join-requests";

describe("ListExperimentJoinRequestsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListExperimentJoinRequestsUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListExperimentJoinRequestsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns not found when the experiment does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
