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
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { RevokeIotDeviceGroupCredentialsUseCase } from "./revoke-iot-device-group-credentials";

describe("RevokeIotDeviceGroupCredentialsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RevokeIotDeviceGroupCredentialsUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Fleet Owner" });
    useCase = testApp.module.get(RevokeIotDeviceGroupCredentialsUseCase);
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

  it("revokes each certificate-holding member and continues past ineligible devices", async () => {
    const revokeSpy = vi
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
    expect(byId.get(active.id)).toEqual({ deviceId: active.id, error: null });
    expect(revokeSpy).toHaveBeenCalledWith("cert-old", "REVOKED");
    // No certificate to revoke: that row fails, the batch does not.
    expect(byId.get(pending.id)?.error).not.toBeNull();

    const deviceRepository = testApp.module.get(IotDeviceRepository);
    const stored = await deviceRepository.findById(active.id);
    assertSuccess(stored);
    expect(stored.value?.status).toBe("revoked");
    expect(stored.value?.certificateId).toBeNull();
  });

  it("reports a non-member selection as a row error", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const groupId = await seedGroup([device.id]);
    const strangerDeviceId = faker.string.uuid();

    const result = await useCase.execute(groupId, [strangerDeviceId], userId);

    assertSuccess(result);
    expect(result.value.devices).toEqual([
      { deviceId: strangerDeviceId, error: "Not a member of this group" },
    ]);
  });

  it("reports an unmanageable member as a row error", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });
    const foreign = await testApp.createIotDevice({ createdBy: stranger, status: "active" });
    const groupId = await seedGroup([foreign.id]);

    const result = await useCase.execute(groupId, undefined, userId);

    assertSuccess(result);
    expect(result.value.devices[0].error).toBe(
      "Only devices you manage can have their certificate revoked",
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
