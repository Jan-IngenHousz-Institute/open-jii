import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { RevokeIotCredentialsUseCase } from "./revoke-iot-credentials";

describe("RevokeIotCredentialsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RevokeIotCredentialsUseCase;
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
    useCase = testApp.module.get(RevokeIotCredentialsUseCase);
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

  const createDevice = async (withCert: boolean) => {
    seq++;
    const created = await repo.create(
      {
        thingName: `ambyte_revoke_${seq}`,
        thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/ambyte_revoke_${seq}`,
        serialNumber: `SN-REVOKE-${seq}`,
        name: null,
        deviceType: "ambyte",
      },
      userId,
    );
    assertSuccess(created);
    const device = created.value[0];
    if (withCert) {
      await repo.update(device.id, userId, {
        status: "active",
        certificateId: "cert-abc",
        certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-abc",
      });
    }
    return device;
  };

  it("revokes the certificate and clears the cert columns", async () => {
    const revokeSpy = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
    const device = await createDevice(true);

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.status).toBe("revoked");
    expect(result.value.certificateId).toBeNull();
    expect(result.value.certificateArn).toBeNull();
    expect(revokeSpy).toHaveBeenCalledWith("cert-abc", "REVOKED");
  });

  it("rejects revoking a device without a certificate", async () => {
    const device = await createDevice(false);

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("returns not found for an unknown device", async () => {
    const result = await useCase.execute("11111111-1111-4111-8111-111111111111", userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
