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
import { RetireIotDeviceUseCase } from "./retire-iot-device";

describe("RetireIotDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RetireIotDeviceUseCase;
  let repo: IotDeviceRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(RetireIotDeviceUseCase);
    repo = testApp.module.get(IotDeviceRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("revokes the certificate and keeps the row as retired", async () => {
    const revoke = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    const detach = vi
      .spyOn(awsAdapter, "detachThingPrincipal")
      .mockResolvedValue(success(undefined));
    const device = await testApp.createIotDevice({
      createdBy: userId,
      status: "active",
      certificateId: "cert-1",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-1",
    });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.status).toBe("retired");
    expect(result.value.certificateId).toBeNull();
    expect(revoke).toHaveBeenCalledWith("cert-1", "REVOKED");
    expect(detach).toHaveBeenCalledWith(device.thingName, expect.stringContaining("cert-1"));
    const stored = await repo.findById(device.id);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("retired");
  });

  it("retires a device that never held a certificate without touching AWS", async () => {
    const revoke = vi.spyOn(awsAdapter, "setCertificateStatus");
    const device = await testApp.createIotDevice({ createdBy: userId, status: "registered" });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.status).toBe("retired");
    expect(revoke).not.toHaveBeenCalled();
  });

  it("refuses a device that is already retired", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "retired" });

    assertFailure(await useCase.execute(device.id, userId));
  });

  it("leaves the device in service when the certificate cannot be revoked", async () => {
    vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(
      failure(AppError.internal("aws down")),
    );
    const device = await testApp.createIotDevice({
      createdBy: userId,
      status: "active",
      certificateId: "cert-2",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-2",
    });

    assertFailure(await useCase.execute(device.id, userId));
    const stored = await repo.findById(device.id);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("active");
    expect(stored.value?.certificateId).toBe("cert-2");
  });
});
