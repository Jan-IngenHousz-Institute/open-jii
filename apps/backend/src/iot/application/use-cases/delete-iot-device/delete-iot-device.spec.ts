import { faker } from "@faker-js/faker";
import type { MockInstance } from "vitest";

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
  let clearConfigSpy: MockInstance<AwsAdapter["clearDeviceConfig"]>;
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
    vi.spyOn(awsAdapter, "listThingPrincipals").mockResolvedValue(success([]));
    clearConfigSpy = vi
      .spyOn(awsAdapter, "clearDeviceConfig")
      .mockResolvedValue(success(undefined));
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
    vi.spyOn(awsAdapter, "listThingPrincipals").mockResolvedValue(
      success(["arn:aws:iot:eu-central-1:000000000000:cert/cert-live"]),
    );
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

  it("clears the retained config, and tolerates the clear failing", async () => {
    const first = await testApp.createIotDevice({ createdBy: userId });
    assertSuccess(await useCase.execute(first.id, userId));
    expect(clearConfigSpy).toHaveBeenCalledWith(first.thingName);

    // Best-effort: the thing is going away either way.
    clearConfigSpy.mockResolvedValue(failure(AppError.internal("broker down")));
    const second = await testApp.createIotDevice({ createdBy: userId });
    assertSuccess(await useCase.execute(second.id, userId));
  });

  it("returns 404 for a missing device", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("propagates a repository lookup failure", async () => {
    vi.spyOn(repo, "findById").mockResolvedValue(failure(AppError.internal("db unavailable")));

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
    vi.spyOn(awsAdapter, "listThingPrincipals").mockResolvedValue(
      success(["arn:aws:iot:eu-central-1:000000000000:cert/cert-live"]),
    );
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

  it("detaches a Cognito identity principal from a certificate-less mobile device", async () => {
    const detachSpy = vi
      .spyOn(awsAdapter, "detachThingPrincipal")
      .mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "listThingPrincipals").mockResolvedValue(
      success(["eu-central-1:cognito-identity-1"]),
    );
    const device = await testApp.createIotDevice({
      createdBy: userId,
      deviceType: "mobile",
      status: "active",
    });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(detachSpy).toHaveBeenCalledWith(device.thingName, "eu-central-1:cognito-identity-1");
    expect(deleteThingSpy).toHaveBeenCalledWith(device.thingName);
  });

  it("propagates the failure when listing thing principals fails", async () => {
    vi.spyOn(awsAdapter, "listThingPrincipals").mockResolvedValue(
      failure(AppError.internal("list failed")),
    );
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
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
