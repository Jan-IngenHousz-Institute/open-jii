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
import { IssueIotDeviceGroupCredentialsUseCase } from "./issue-iot-device-group-credentials";

const CERT = {
  certificateId: "cert-new",
  certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-new",
  certificatePem: "-----BEGIN CERTIFICATE-----\nNEW\n-----END CERTIFICATE-----",
  publicKey: "-----BEGIN PUBLIC KEY-----\nNEW\n-----END PUBLIC KEY-----",
  privateKey: "-----BEGIN RSA PRIVATE KEY-----\nNEW\n-----END RSA PRIVATE KEY-----",
};

describe("IssueIotDeviceGroupCredentialsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: IssueIotDeviceGroupCredentialsUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Fleet Owner" });
    useCase = testApp.module.get(IssueIotDeviceGroupCredentialsUseCase);
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

  it("issues a certificate per member and continues past ineligible devices", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(success(undefined));
    const pending = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
    const active = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const groupId = await seedGroup([pending.id, active.id]);

    const result = await useCase.execute(groupId, undefined, userId);

    assertSuccess(result);
    const byId = new Map(result.value.devices.map((row) => [row.deviceId, row]));
    expect(byId.get(pending.id)).toEqual({
      deviceId: pending.id,
      thingName: pending.thingName,
      credentials: CERT,
      error: null,
    });
    // A live certificate blocks issuing: that row fails, the batch does not.
    expect(byId.get(active.id)?.credentials).toBeNull();
    expect(byId.get(active.id)?.error).toContain("already has a certificate");
  });

  it("runs a repeated selection id only once", async () => {
    vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(success(undefined));
    const pending = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
    const groupId = await seedGroup([pending.id]);

    const result = await useCase.execute(groupId, [pending.id, pending.id], userId);

    assertSuccess(result);
    expect(result.value.devices).toHaveLength(1);
    expect(result.value.devices[0].error).toBeNull();
  });

  it("reports a non-member selection as a row error", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
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
    const foreign = await testApp.createIotDevice({ createdBy: stranger, status: "pending" });
    const groupId = await seedGroup([foreign.id]);

    const result = await useCase.execute(groupId, undefined, userId);

    assertSuccess(result);
    expect(result.value.devices[0].credentials).toBeNull();
    expect(result.value.devices[0].error).toBe("Only devices you manage can be issued credentials");
  });

  it("rejects a default-everyone batch beyond the selection cap", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
    const groupId = await seedGroup([device.id]);
    vi.spyOn(groupRepository, "listMembers").mockResolvedValue(
      success(
        Array.from({ length: 101 }, (_, index) => ({
          deviceId: faker.string.uuid(),
          name: null,
          serialNumber: `S-${String(index)}`,
          deviceType: "ambyte" as const,
          status: "pending" as const,
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
