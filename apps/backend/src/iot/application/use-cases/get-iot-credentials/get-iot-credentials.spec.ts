import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import {
  assertFailure,
  assertSuccess,
  AppError,
  success,
  failure,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetIotCredentialsUseCase } from "./get-iot-credentials";

describe("GetIotCredentialsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotCredentialsUseCase;
  let awsAdapter: AwsAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetIotCredentialsUseCase);
    awsAdapter = testApp.module.get(AwsAdapter);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully return IoT credentials", async () => {
    const userId = "user-123";
    const mockCredentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      sessionToken: "session-token",
      expiration: new Date("2026-02-06T12:00:00Z"),
    };

    vi.spyOn(awsAdapter, "getIotCredentials").mockResolvedValue(success(mockCredentials));

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toEqual(mockCredentials);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsAdapter.getIotCredentials).toHaveBeenCalledWith(userId);
  });

  it("should return failure when AWS adapter fails", async () => {
    const userId = "user-123";
    const error = AppError.internal("Cognito error", ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED);

    vi.spyOn(awsAdapter, "getIotCredentials").mockResolvedValue(failure(error));

    const result = await useCase.execute(userId);

    assertFailure(result);
    expect(result.error).toEqual(error);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsAdapter.getIotCredentials).toHaveBeenCalledWith(userId);
  });
});
