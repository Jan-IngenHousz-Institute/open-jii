import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { RotateIotCredentialsUseCase } from "./rotate-iot-credentials";

const NEW_CERT = {
  certificateId: "cert-new",
  certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-new",
  certificatePem: "-----BEGIN CERTIFICATE-----\nNEW\n-----END CERTIFICATE-----",
  publicKey: "-----BEGIN PUBLIC KEY-----\nNEW\n-----END PUBLIC KEY-----",
  privateKey: "-----BEGIN RSA PRIVATE KEY-----\nNEW\n-----END RSA PRIVATE KEY-----",
};

describe("RotateIotCredentialsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RotateIotCredentialsUseCase;
  let repo: IotDeviceRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;
  let seq = 0;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(RotateIotCredentialsUseCase);
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

  const createDevice = async (status: "pending" | "active") => {
    seq++;
    const created = await repo.create(
      {
        thingName: `ambyte_rotate_${seq}`,
        thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/ambyte_rotate_${seq}`,
        serialNumber: `SN-ROTATE-${seq}`,
        name: null,
        deviceType: "ambyte",
      },
      userId,
    );
    assertSuccess(created);
    const device = created.value[0];
    if (status === "active") {
      await repo.update(device.id, userId, {
        status: "active",
        certificateId: "cert-old",
        certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-old",
      });
    }
    return device;
  };

  it("issues a new certificate, retires the old one, and stays active", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(NEW_CERT));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(success(undefined));
    const retireSpy = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
    const device = await createDevice("active");

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value).toEqual(NEW_CERT);
    expect(retireSpy).toHaveBeenCalledWith("cert-old", "REVOKED");

    const stored = await repo.findByIdForOwner(device.id, userId);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("active");
    expect(stored.value?.certificateId).toBe(NEW_CERT.certificateId);
  });

  it("rejects rotating a device that is not active", async () => {
    const device = await createDevice("pending");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("reverts to active when the new certificate cannot be created", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(
      failure(AppError.internal("cert failed")),
    );
    const device = await createDevice("active");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    const stored = await repo.findByIdForOwner(device.id, userId);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("active");
    expect(stored.value?.certificateId).toBe("cert-old");
  });
});
