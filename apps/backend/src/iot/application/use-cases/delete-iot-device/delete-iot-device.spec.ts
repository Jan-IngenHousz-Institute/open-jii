import { faker } from "@faker-js/faker";

import { eq, iotDevices } from "@repo/database";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { DeleteIotDeviceUseCase } from "./delete-iot-device";

describe("DeleteIotDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteIotDeviceUseCase;
  let awsAdapter: AwsAdapter;
  let repo: IotDeviceRepository;
  let deleteThingSpy: ReturnType<typeof vi.spyOn>;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(DeleteIotDeviceUseCase);
    awsAdapter = testApp.module.get(AwsAdapter);
    repo = testApp.module.get(IotDeviceRepository);
    deleteThingSpy = vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("deletes the owner's device and its Thing", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(deleteThingSpy).toHaveBeenCalledWith(device.thingName);

    const rows = await testApp.database
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.id, device.id));
    expect(rows).toHaveLength(0);
  });

  it("revokes and detaches a live certificate before deleting the Thing", async () => {
    const revokeSpy = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    const detachSpy = vi
      .spyOn(awsAdapter, "detachThingPrincipal")
      .mockResolvedValue(success(undefined));
    const device = await testApp.createIotDevice({
      createdBy: userId,
      status: "active",
      certificateId: "cert-live",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-live",
    });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(revokeSpy).toHaveBeenCalledWith("cert-live", "REVOKED");
    expect(detachSpy).toHaveBeenCalledWith(
      device.thingName,
      "arn:aws:iot:eu-central-1:000000000000:cert/cert-live",
    );
    expect(deleteThingSpy).toHaveBeenCalledWith(device.thingName);
  });

  it("returns 404 for a missing device", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns 404 for another user's device", async () => {
    const otherUser = await testApp.createTestUser({});
    const device = await testApp.createIotDevice({ createdBy: otherUser });

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("propagates a repository lookup failure", async () => {
    vi.spyOn(repo, "findByIdForOwner").mockResolvedValue(
      failure(AppError.internal("db unavailable")),
    );

    const result = await useCase.execute(faker.string.uuid(), userId);

    assertFailure(result);
    expect(result.error.message).toBe("db unavailable");
  });

  it("propagates the failure when revoking the certificate fails", async () => {
    vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(
      failure(AppError.internal("revoke failed")),
    );
    const device = await testApp.createIotDevice({
      createdBy: userId,
      status: "active",
      certificateId: "cert-live",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-live",
    });

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("revoke failed");
    expect(deleteThingSpy).not.toHaveBeenCalled();
  });

  it("propagates the failure when detaching the principal fails", async () => {
    vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(
      failure(AppError.internal("detach failed")),
    );
    const device = await testApp.createIotDevice({
      createdBy: userId,
      status: "active",
      certificateId: "cert-live",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-live",
    });

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("detach failed");
    expect(deleteThingSpy).not.toHaveBeenCalled();
  });

  it("propagates the failure when deleting the Thing fails", async () => {
    vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(
      failure(AppError.internal("delete thing failed")),
    );
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("delete thing failed");
  });

  it("propagates the failure when the repository delete fails", async () => {
    vi.spyOn(repo, "delete").mockResolvedValue(failure(AppError.internal("db delete failed")));
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("db delete failed");
  });
});
