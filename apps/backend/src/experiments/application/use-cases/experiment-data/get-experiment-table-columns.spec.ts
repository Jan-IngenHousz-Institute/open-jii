import { faker } from "@faker-js/faker";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDataRepository } from "../../../core/repositories/experiment-data.repository";
import { GetExperimentTableColumnsUseCase } from "./get-experiment-table-columns";

describe("GetExperimentTableColumnsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentTableColumnsUseCase;
  let experimentDataRepository: ExperimentDataRepository;

  const columns = [
    { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP", position: 0 },
    { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE", position: 1 },
  ];

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(GetExperimentTableColumnsUseCase);
    experimentDataRepository = testApp.module.get(ExperimentDataRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return the table's columns", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    const repoSpy = vi
      .spyOn(experimentDataRepository, "getTableColumns")
      .mockResolvedValue(success(columns));

    const result = await useCase.execute(experiment.id, testUserId, { tableName: "raw_data" });

    assertSuccess(result);
    expect(result.value).toEqual({ columns });
    expect(repoSpy).toHaveBeenCalledWith({ experimentId: experiment.id, tableName: "raw_data" });
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = faker.string.uuid();

    const result = await useCase.execute(nonExistentId, testUserId, { tableName: "raw_data" });

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(nonExistentId);
  });

  it("should propagate repository failure", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    vi.spyOn(experimentDataRepository, "getTableColumns").mockResolvedValue(
      failure(AppError.internal("Failed to read columns")),
    );

    const result = await useCase.execute(experiment.id, testUserId, { tableName: "raw_data" });

    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
