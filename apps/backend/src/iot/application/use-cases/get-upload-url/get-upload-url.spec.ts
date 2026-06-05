import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../../experiments/core/models/experiment.model";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { TestHarness } from "../../../../test/test-harness";
import { GetIotUploadUrlUseCase } from "./get-upload-url";

describe("GetIotUploadUrlUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotUploadUrlUseCase;
  let awsAdapter: AwsAdapter;
  let experimentRepository: ExperimentRepository;

  const experimentId = "123e4567-e89b-12d3-a456-426614174000";
  const userId = "user-123";
  const mockExperiment = { id: experimentId, name: "Test" } as unknown as ExperimentDto;
  const mockUploadUrl = {
    uploadUrl: "https://bucket.s3.amazonaws.com/presigned",
    key: `large-iot/${experimentId}/uuid.json`,
    expiresAt: new Date("2026-05-13T12:15:00Z"),
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetIotUploadUrlUseCase);
    awsAdapter = testApp.module.get(AwsAdapter);
    experimentRepository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return upload URL when user is a member", async () => {
    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      success({
        experiment: mockExperiment,
        hasAccess: true,
        isAdmin: false,
        hasArchiveAccess: false,
      }),
    );
    vi.spyOn(awsAdapter, "getIotUploadUrl").mockResolvedValue(success(mockUploadUrl));

    const result = await useCase.execute(experimentId, userId);

    assertSuccess(result);
    expect(result.value).toEqual(mockUploadUrl);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(experimentRepository.checkAccess).toHaveBeenCalledWith(experimentId, userId);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsAdapter.getIotUploadUrl).toHaveBeenCalledWith(experimentId);
  });

  it("should return not found when experiment does not exist", async () => {
    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      success({ experiment: null, hasAccess: false, isAdmin: false, hasArchiveAccess: false }),
    );

    const result = await useCase.execute(experimentId, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("should return forbidden when user is not a member", async () => {
    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      success({
        experiment: mockExperiment,
        hasAccess: false,
        isAdmin: false,
        hasArchiveAccess: false,
      }),
    );

    const result = await useCase.execute(experimentId, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("should return failure when AWS adapter fails", async () => {
    const error = AppError.internal("S3 error", ErrorCodes.AWS_S3_PRESIGN_FAILED);

    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      success({
        experiment: mockExperiment,
        hasAccess: true,
        isAdmin: false,
        hasArchiveAccess: false,
      }),
    );
    vi.spyOn(awsAdapter, "getIotUploadUrl").mockResolvedValue(failure(error));

    const result = await useCase.execute(experimentId, userId);

    assertFailure(result);
    expect(result.error).toEqual(error);
  });

  it("should propagate failure when checkAccess itself fails", async () => {
    const error = AppError.internal("DB error");
    const awsSpy = vi.spyOn(awsAdapter, "getIotUploadUrl");

    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(failure(error));

    const result = await useCase.execute(experimentId, userId);

    assertFailure(result);
    expect(result.error).toEqual(error);
    expect(awsSpy).not.toHaveBeenCalled();
  });
});
