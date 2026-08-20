import { faker } from "@faker-js/faker";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { RotateIotDeviceGroupCredentialsUseCase } from "./rotate-iot-device-group-credentials";

const NEW_CERT = {
  certificateId: "cert-new",
  certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-new",
  certificatePem: "-----BEGIN CERTIFICATE-----\nNEW\n-----END CERTIFICATE-----",
  publicKey: "-----BEGIN PUBLIC KEY-----\nNEW\n-----END PUBLIC KEY-----",
  privateKey: "-----BEGIN RSA PRIVATE KEY-----\nNEW\n-----END RSA PRIVATE KEY-----",
};

describe("RotateIotDeviceGroupCredentialsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RotateIotDeviceGroupCredentialsUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Fleet Owner" });
    useCase = testApp.module.get(RotateIotDeviceGroupCredentialsUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedGroup(deviceIds: string[]) {
    const createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    const created = await createGroup.execute({ name: "Fleet" }, userId);
    assertSuccess(created);
    const added = await groupRepository.addMembers(created.value.id, deviceIds, userId);
    assertSuccess(added);
    return created.value.id;
  }

  it("rotates each active member and continues past ineligible devices", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(NEW_CERT));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(success(undefined));
    const retireSpy = vi
      .spyOn(awsAdapter, "setCertificateStatus")
      .mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
    const active = await testApp.createIotDevice({
      createdBy: userId,
      status: "active",
      certificateId: "cert-old",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-old",
    });
    const pending = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
    const groupId = await seedGroup([active.id, pending.id]);

    const result = await useCase.execute(groupId, undefined, userId);

    assertSuccess(result);
    const byId = new Map(result.value.devices.map((row) => [row.deviceId, row]));
    expect(byId.get(active.id)).toEqual({
      deviceId: active.id,
      thingName: active.thingName,
      credentials: NEW_CERT,
      error: null,
    });
    expect(retireSpy).toHaveBeenCalledWith("cert-old", "REVOKED");
    // Nothing to rotate: that row fails, the batch does not.
    expect(byId.get(pending.id)?.credentials).toBeNull();
    expect(byId.get(pending.id)?.error).not.toBeNull();
  });

  it("reports a non-member selection as a row error", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const groupId = await seedGroup([device.id]);
    const strangerDeviceId = faker.string.uuid();

    const result = await useCase.execute(groupId, [strangerDeviceId], userId);

    assertSuccess(result);
    expect(result.value.devices).toEqual([
      {
        deviceId: strangerDeviceId,
        thingName: null,
        credentials: null,
        error: "Not a member of this group",
      },
    ]);
  });

  it("reports an unmanageable member as a row error", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });
    const foreign = await testApp.createIotDevice({ createdBy: stranger, status: "active" });
    const groupId = await seedGroup([foreign.id]);

    const result = await useCase.execute(groupId, undefined, userId);

    assertSuccess(result);
    expect(result.value.devices[0].credentials).toBeNull();
    expect(result.value.devices[0].error).toBe(
      "Only devices you manage can have their certificate rotated",
    );
  });

  it("rejects a default-everyone batch beyond the selection cap", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const groupId = await seedGroup([device.id]);
    vi.spyOn(groupRepository, "listMembers").mockResolvedValue(
      success(
        Array.from({ length: 101 }, (_, index) => ({
          deviceId: faker.string.uuid(),
          name: null,
          serialNumber: `S-${String(index)}`,
          deviceType: "ambyte" as const,
          status: "active" as const,
          thingName: `ambyte_${String(index)}`,
          addedAt: new Date(),
        })),
      ),
    );

    const result = await useCase.execute(groupId, undefined, userId);

    assertFailure(result);
    expect(result.error.message).toContain("explicit selection");
  });

  it("propagates a repository failure", async () => {
    vi.spyOn(groupRepository, "listMembers").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(faker.string.uuid(), undefined, userId);

    expect(result.isFailure()).toBe(true);
  });
});
