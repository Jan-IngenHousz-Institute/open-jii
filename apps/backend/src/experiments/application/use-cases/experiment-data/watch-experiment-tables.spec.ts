import { assertFailure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentTablesChange } from "../../../core/models/experiment-data.model";
import { ExperimentTableChangesService } from "../../services/experiment-table-changes.service";
import { WatchExperimentTablesUseCase } from "./watch-experiment-tables";

describe("WatchExperimentTablesUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: WatchExperimentTablesUseCase;
  let tableChanges: ExperimentTableChangesService;

  async function* changes(): AsyncGenerator<ExperimentTablesChange, void> {
    await Promise.resolve();
    yield { type: "heartbeat" };
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(WatchExperimentTablesUseCase);
    tableChanges = testApp.module.get(ExperimentTableChangesService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should refuse a warehouse reader as not found and open no stream", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });
    const open = vi.spyOn(tableChanges, "open");

    const result = useCase.execute(experiment.id, testUserId, "warehouse");

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(open).not.toHaveBeenCalled();
  });

  it("should open a store stream for the user with the signal it was given", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });
    const stream = success(changes());
    const open = vi.spyOn(tableChanges, "open").mockReturnValue(stream);
    const request = new AbortController();

    const result = useCase.execute(experiment.id, testUserId, "store", request.signal);

    expect(result).toBe(stream);
    expect(open).toHaveBeenCalledWith(experiment.id, testUserId, request.signal);
  });
});
