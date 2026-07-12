import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { IssueIotCredentialsUseCase } from "./issue-iot-credentials";

const CERT = {
  certificateId: "cert-123",
  certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-123",
  certificatePem: "-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----",
  publicKey: "-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----",
  privateKey: "-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----",
};

describe("IssueIotCredentialsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: IssueIotCredentialsUseCase;
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
    useCase = testApp.module.get(IssueIotCredentialsUseCase);
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

  const createDevice = async (status: "pending" | "active" | "revoked" = "pending") => {
    seq++;
    const created = await repo.create(
      {
        thingName: `ambyte_issue_${seq}`,
        thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/ambyte_issue_${seq}`,
        serialNumber: `SN-ISSUE-${seq}`,
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
        certificateId: "old-cert",
        certificateArn: "arn:old",
      });
    }
    if (status === "revoked") {
      await repo.update(device.id, userId, {
        status: "revoked",
        certificateId: null,
        certificateArn: null,
      });
    }
    return device;
  };

  const mockHappyPath = () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(success(undefined));
  };

  it("issues a certificate, activates the device, and returns the show-once bundle", async () => {
    mockHappyPath();
    const device = await createDevice("pending");

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value).toEqual(CERT);

    const stored = await repo.findByIdForOwner(device.id, userId);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("active");
    expect(stored.value?.certificateId).toBe(CERT.certificateId);
    expect(stored.value?.certificateArn).toBe(CERT.certificateArn);
  });

  it("re-issues a certificate for a revoked device", async () => {
    mockHappyPath();
    const device = await createDevice("revoked");

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value).toEqual(CERT);

    const stored = await repo.findByIdForOwner(device.id, userId);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("active");
    expect(stored.value?.certificateId).toBe(CERT.certificateId);
  });

  it("rejects issuing when the device already has a live certificate", async () => {
    const device = await createDevice("active");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("revokes the new certificate when principal attachment fails", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(
      failure(AppError.internal("attach failed")),
    );
    const revokeSpy = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    const device = await createDevice("pending");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(revokeSpy).toHaveBeenCalledWith(CERT.certificateId, "REVOKED");

    const stored = await repo.findByIdForOwner(device.id, userId);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("pending");
  });

  it("propagates the failure when the certificate cannot be created", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(
      failure(AppError.internal("cert failed")),
    );
    const device = await createDevice("pending");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("cert failed");
  });

  it("returns not found for an unknown device", async () => {
    const result = await useCase.execute("11111111-1111-4111-8111-111111111111", userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("propagates a repository lookup failure", async () => {
    vi.spyOn(repo, "findByIdForOwner").mockResolvedValue(
      failure(AppError.internal("db unavailable")),
    );

    const result = await useCase.execute("11111111-1111-4111-8111-111111111111", userId);

    assertFailure(result);
    expect(result.error.message).toBe("db unavailable");
  });

  it("detaches and revokes the certificate when policy attachment fails", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(
      failure(AppError.internal("policy failed")),
    );
    const detachSpy = vi
      .spyOn(awsAdapter, "detachThingPrincipal")
      .mockResolvedValue(success(undefined));
    const revokeSpy = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    const device = await createDevice("pending");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(detachSpy).toHaveBeenCalledWith(device.thingName, CERT.certificateArn);
    expect(revokeSpy).toHaveBeenCalledWith(CERT.certificateId, "REVOKED");

    const stored = await repo.findByIdForOwner(device.id, userId);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("pending");
  });

  it("rolls the certificate back when persistence fails", async () => {
    mockHappyPath();
    const revokeSpy = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
    const device = await createDevice("pending");
    vi.spyOn(repo, "update").mockResolvedValue(failure(AppError.internal("write failed")));

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("write failed");
    expect(revokeSpy).toHaveBeenCalledWith(CERT.certificateId, "REVOKED");
  });

  it("fails with an internal error when persistence matches no row", async () => {
    mockHappyPath();
    vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
    const device = await createDevice("pending");
    vi.spyOn(repo, "update").mockResolvedValue(success(undefined));

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
  });

  it("returns the original failure even when best-effort cleanup also fails", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(
      failure(AppError.internal("policy failed")),
    );
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(
      failure(AppError.internal("detach failed")),
    );
    vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(
      failure(AppError.internal("revoke failed")),
    );
    const device = await createDevice("pending");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("policy failed");
  });
});
