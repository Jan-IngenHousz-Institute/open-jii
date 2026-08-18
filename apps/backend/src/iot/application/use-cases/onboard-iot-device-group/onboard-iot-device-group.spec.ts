import { faker } from "@faker-js/faker";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { OnboardIotDeviceGroupUseCase } from "./onboard-iot-device-group";

describe("OnboardIotDeviceGroupUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: OnboardIotDeviceGroupUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Fleet Owner" });
    useCase = testApp.module.get(OnboardIotDeviceGroupUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);
    const awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "getIotDataEndpoint").mockResolvedValue(
      success("data.iot.example.amazonaws.com"),
    );
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

  it("re-issues a config per member and continues past ineligible devices", async () => {
    const active = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const pending = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
    const groupId = await seedGroup([active.id, pending.id]);

    const result = await useCase.execute(
      groupId,
      { experimentIds: [], includeWorkbook: true },
      userId,
    );

    assertSuccess(result);
    expect(result.value.devices).toHaveLength(2);
    const byId = new Map(result.value.devices.map((row) => [row.deviceId, row]));
    expect(byId.get(active.id)?.config?.thingName).toBe(active.thingName);
    expect(byId.get(active.id)?.error).toBeNull();
    // No live credentials: that row fails, the batch does not.
    expect(byId.get(pending.id)?.config).toBeNull();
    expect(byId.get(pending.id)?.error).toContain("active credentials");
  });

  it("binds the selection to an experiment through the single-device executor", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const groupId = await seedGroup([device.id]);
    const { experiment } = await testApp.createExperiment({ name: "Field trial", userId });

    const result = await useCase.execute(
      groupId,
      { experimentIds: [experiment.id], deviceIds: [device.id], includeWorkbook: true },
      userId,
    );

    assertSuccess(result);
    const row = result.value.devices[0];
    expect(row.error).toBeNull();
    expect(row.config?.experiments.map((entry) => entry.experimentId)).toEqual([experiment.id]);
  });

  it("rejects a default-everyone batch beyond the selection cap", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const groupId = await seedGroup([device.id]);
    const repo = testApp.module.get(IotDeviceGroupRepository);
    // 101 phantom members: only the ceiling matters, not their existence.
    vi.spyOn(repo, "listMembers").mockResolvedValue(
      success(
        Array.from({ length: 101 }, (_, index) => ({
          deviceId: faker.string.uuid(),
          name: null,
          serialNumber: `S-${String(index)}`,
          deviceType: "ambyte" as const,
          status: "active" as const,
          addedAt: new Date(),
        })),
      ),
    );

    const result = await useCase.execute(
      groupId,
      { experimentIds: [], includeWorkbook: true },
      userId,
    );

    assertFailure(result);
    expect(result.error.message).toContain("explicit selection");
  });

  it("reports a non-member selection as a row error", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
    const groupId = await seedGroup([device.id]);
    const strangerDeviceId = faker.string.uuid();

    const result = await useCase.execute(
      groupId,
      { experimentIds: [], deviceIds: [strangerDeviceId], includeWorkbook: true },
      userId,
    );

    assertSuccess(result);
    expect(result.value.devices).toEqual([
      { deviceId: strangerDeviceId, config: null, error: "Not a member of this group" },
    ]);
  });

  it("reports an unmanageable member as a row error", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });
    const foreign = await testApp.createIotDevice({ createdBy: stranger, status: "active" });
    const groupId = await seedGroup([foreign.id]);

    const result = await useCase.execute(
      groupId,
      { experimentIds: [], includeWorkbook: true },
      userId,
    );

    assertSuccess(result);
    expect(result.value.devices[0].config).toBeNull();
    expect(result.value.devices[0].error).toBe("Only devices you manage can be onboarded");
  });
});
