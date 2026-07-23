import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetIotUploadUrlUseCase } from "./get-upload-url";

describe("GetIotUploadUrlUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotUploadUrlUseCase;
  let awsAdapter: AwsAdapter;
  let experimentId: string;

  const mockUploadUrl = {
    uploadUrl: "https://bucket.s3.amazonaws.com/presigned",
    key: "large-iot/experiment-id/uuid.json",
    expiresAt: new Date("2026-05-13T12:15:00Z"),
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetIotUploadUrlUseCase);
    awsAdapter = testApp.module.get(AwsAdapter);
    const userId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "IoT upload URL experiment",
      userId,
    });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return an upload URL", async () => {
    vi.spyOn(awsAdapter, "getIotUploadUrl").mockResolvedValue(success(mockUploadUrl));

    const result = await useCase.execute(experimentId);

    assertSuccess(result);
    expect(result.value).toEqual(mockUploadUrl);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsAdapter.getIotUploadUrl).toHaveBeenCalledWith(experimentId);
  });

  it("should return failure when AWS adapter fails", async () => {
    const error = AppError.internal("S3 error", ErrorCodes.AWS_S3_PRESIGN_FAILED);

    vi.spyOn(awsAdapter, "getIotUploadUrl").mockResolvedValue(failure(error));

    const result = await useCase.execute(experimentId);

    assertFailure(result);
    expect(result.error).toEqual(error);
  });

  it("should return not found when experiment does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000");

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
