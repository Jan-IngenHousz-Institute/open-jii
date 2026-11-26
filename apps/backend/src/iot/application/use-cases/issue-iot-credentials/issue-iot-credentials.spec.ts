import { experimentDataOutbox } from "@repo/database";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
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

  const createDevice = async (status: "registered" | "active" | "revoked" = "registered") => {
    seq++;
    const created = await repo.transaction((tx) =>
      repo.create(
        tx,
        {
          thingName: `ambyte_issue_${seq}`,
          thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/ambyte_issue_${seq}`,
          serialNumber: `SN-ISSUE-${seq}`,
          name: null,
          deviceType: "ambyte",
        },
        userId,
      ),
    );
    assertSuccess(created);
    const device = created.value;
    if (status === "active") {
      await repo.transaction((tx) =>
        repo.update(tx, device.id, {
          status: "active",
          certificateId: "old-cert",
          certificateArn: "arn:old",
        }),
      );
    }
    if (status === "revoked") {
      await repo.transaction((tx) =>
        repo.update(tx, device.id, {
          status: "revoked",
          certificateId: null,
          certificateArn: null,
        }),
      );
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
    const device = await createDevice("registered");

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value).toEqual(CERT);

    const stored = await repo.findById(device.id);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("active");
    expect(stored.value?.certificateId).toBe(CERT.certificateId);
    expect(stored.value?.certificateArn).toBe(CERT.certificateArn);
  });

  it("creates the thing first for a device registered by connection (decision 2)", async () => {
    mockHappyPath();
    const createThing = vi.spyOn(awsAdapter, "createThing").mockResolvedValue(
      success({
        thingName: "minipar_58:CF:79:12:34:56",
        thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/minipar_58:CF:79:12:34:56",
      }),
    );
    const device = await testApp.createIotDevice({
      createdBy: userId,
      deviceType: "minipar",
      serialNumber: "58:CF:79:12:34:56",
      thingName: "minipar_58:CF:79:12:34:56",
      thingArn: null,
    });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(createThing).toHaveBeenCalledWith({
      thingName: "minipar_58:CF:79:12:34:56",
      attributes: { deviceType: "minipar", serialNumber: "58:CF:79:12:34:56" },
    });
    const stored = await repo.findById(device.id);
    assertSuccess(stored);
    expect(stored.value?.thingArn).toBe(
      "arn:aws:iot:eu-central-1:000000000000:thing/minipar_58:CF:79:12:34:56",
    );
    expect(stored.value?.status).toBe("active");
  });

  it("keeps the device without a certificate when creating its thing fails", async () => {
    const createCert = vi.spyOn(awsAdapter, "createDeviceCertificate");
    vi.spyOn(awsAdapter, "createThing").mockResolvedValue(
      failure(AppError.internal("CreateThing failed")),
    );
    const device = await testApp.createIotDevice({
      createdBy: userId,
      deviceType: "ambit",
      thingArn: null,
    });

    assertFailure(await useCase.execute(device.id, userId));

    expect(createCert).not.toHaveBeenCalled();
    const stored = await repo.findById(device.id);
    assertSuccess(stored);
    expect(stored.value?.thingArn).toBeNull();
    expect(stored.value?.status).toBe("registered");
  });

  it("does not create a thing for a device that already has one", async () => {
    mockHappyPath();
    const createThing = vi.spyOn(awsAdapter, "createThing");
    const device = await createDevice("registered");

    assertSuccess(await useCase.execute(device.id, userId));

    expect(createThing).not.toHaveBeenCalled();
  });

  it("re-issues a certificate for a revoked device", async () => {
    mockHappyPath();
    const device = await createDevice("revoked");

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value).toEqual(CERT);

    const stored = await repo.findById(device.id);
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
    const device = await createDevice("registered");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(revokeSpy).toHaveBeenCalledWith(CERT.certificateId, "REVOKED");

    const stored = await repo.findById(device.id);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("registered");
  });

  it("propagates the failure when the certificate cannot be created", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(
      failure(AppError.internal("cert failed")),
    );
    const device = await createDevice("registered");

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
    vi.spyOn(repo, "findById").mockResolvedValue(failure(AppError.internal("db unavailable")));

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
    const device = await createDevice("registered");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(detachSpy).toHaveBeenCalledWith(device.thingName, CERT.certificateArn);
    expect(revokeSpy).toHaveBeenCalledWith(CERT.certificateId, "REVOKED");

    const stored = await repo.findById(device.id);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("registered");
  });

  it("rolls the certificate back when persistence fails", async () => {
    mockHappyPath();
    const revokeSpy = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
    const device = await createDevice("registered");
    vi.spyOn(repo, "update").mockRejectedValue(AppError.internal("write failed"));

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("write failed");
    expect(revokeSpy).toHaveBeenCalledWith(CERT.certificateId, "REVOKED");
  });

  it("fails with an internal error when persistence matches no row", async () => {
    mockHappyPath();
    vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
    const device = await createDevice("registered");
    vi.spyOn(repo, "update").mockResolvedValue(null);

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
    const device = await createDevice("registered");

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("policy failed");
  });

  it("refuses a retired device until it is reinstated", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "retired" });

    assertFailure(await useCase.execute(device.id, userId));
  });

  describe("the registry's lakehouse copy", () => {
    const owed = () => testApp.database.select().from(experimentDataOutbox);

    it("is owed the device's activation in the same transaction, and the worker nudged", async () => {
      mockHappyPath();
      const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");
      const device = await createDevice("registered");

      assertSuccess(await useCase.execute(device.id, userId));

      expect(await owed()).toEqual([
        expect.objectContaining({
          recordType: "device",
          recordId: device.id,
          experimentId: null,
          destination: "lakehouse",
        }),
      ]);
      expect(nudge).toHaveBeenCalledTimes(1);
    });

    it("keeps the device without credentials, and revokes the new ones, when the copy it owes cannot be written", async () => {
      mockHappyPath();
      const revoke = vi
        .spyOn(awsAdapter, "setCertificateStatus")
        .mockResolvedValue(success(undefined));
      vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
      vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "owe").mockRejectedValue(
        new Error("outbox unavailable"),
      );
      const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");
      const device = await createDevice("registered");

      assertFailure(await useCase.execute(device.id, userId));

      const stored = await repo.findById(device.id);
      assertSuccess(stored);
      expect(stored.value?.status).toBe("registered");
      expect(stored.value?.certificateId).toBeNull();
      expect(revoke).toHaveBeenCalledWith(CERT.certificateId, "REVOKED");
      expect(nudge).not.toHaveBeenCalled();
    });
  });
});
