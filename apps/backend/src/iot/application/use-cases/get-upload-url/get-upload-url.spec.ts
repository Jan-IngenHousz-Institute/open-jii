import { sessions, users } from "@repo/database";

import { DEMO_MODE_PORT } from "../../../../authorization/core/ports/demo-mode.port";
import type { DemoModePort } from "../../../../authorization/core/ports/demo-mode.port";
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
  let userId: string;

  const mockUploadUrl = {
    uploadUrl: "https://bucket.s3.amazonaws.com/presigned",
    key: "large-iot/experiment-id/uploader-id/uuid.json",
    expiresAt: new Date("2026-05-13T12:15:00Z"),
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetIotUploadUrlUseCase);
    awsAdapter = testApp.module.get(AwsAdapter);
    userId = await testApp.createTestUser({});
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

    const result = await useCase.execute(experimentId, userId);

    assertSuccess(result);
    expect(result.value).toEqual(mockUploadUrl);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsAdapter.getIotUploadUrl).toHaveBeenCalledWith(experimentId, userId);
  });

  it("refuses a deleted identity before signing an upload", async () => {
    const signer = vi.spyOn(awsAdapter, "getIotUploadUrl");
    const result = await useCase.execute(experimentId, crypto.randomUUID(), 20);
    assertFailure(result);
    expect(result.error.statusCode).toBe(401);
    expect(signer).not.toHaveBeenCalled();
  });

  it("refuses a guest upload outside Demo even when called without the HTTP guard", async () => {
    const guest = await testApp.createTestUser({ isAnonymous: true, createProfile: false });
    const signer = vi.spyOn(awsAdapter, "getIotUploadUrl");
    const result = await useCase.execute(experimentId, guest, 20);
    assertFailure(result);
    expect(result.error.code).toBe("GUEST_ACTION_FORBIDDEN");
    expect(signer).not.toHaveBeenCalled();
  });

  it("should return failure when AWS adapter fails", async () => {
    const error = AppError.internal("S3 error", ErrorCodes.AWS_S3_PRESIGN_FAILED);

    vi.spyOn(awsAdapter, "getIotUploadUrl").mockResolvedValue(failure(error));

    const result = await useCase.execute(experimentId, userId);

    assertFailure(result);
    expect(result.error).toEqual(error);
  });

  it("passes the guest session user and declared size to the signer", async () => {
    const [guest] = await testApp.database
      .insert(users)
      .values({
        name: "Synthetic visitor",
        email: `${crypto.randomUUID()}@guest.openjii.invalid`,
        isAnonymous: true,
      })
      .returning();
    await testApp.database.insert(sessions).values({
      userId: guest.id,
      token: `test-token-${guest.id}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const organization = await testApp.createOrganization(undefined, {
      type: "demo",
      visibility: "public",
    });
    const { experiment } = await testApp.createExperiment({
      name: "Demo upload",
      userId,
      organizationId: organization,
      visibility: "public",
    });
    vi.spyOn(testApp.module.get<DemoModePort>(DEMO_MODE_PORT), "isEnabled").mockResolvedValue(true);
    const signer = vi
      .spyOn(awsAdapter, "getIotUploadUrl")
      .mockResolvedValue(success(mockUploadUrl));

    const result = await useCase.execute(experiment.id, guest.id, 100);

    assertSuccess(result);
    expect(signer).toHaveBeenCalledWith(experiment.id, guest.id, { guestContentLength: 100 });
  });

  it("refuses a caller deleted after authorization without issuing an upload URL", async () => {
    const issue = vi.spyOn(awsAdapter, "getIotUploadUrl");

    const result = await useCase.execute(experimentId, crypto.randomUUID(), 100);

    assertFailure(result);
    expect(result.error.statusCode).toBe(401);
    expect(issue).not.toHaveBeenCalled();
  });

  it("should return not found when experiment does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
