import { faker } from "@faker-js/faker";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { AppError, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { RegisterIotDeviceUseCase } from "../register-iot-device/register-iot-device";
import { BulkRegisterIotDevicesUseCase } from "./bulk-register-iot-devices";

describe("BulkRegisterIotDevicesUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: BulkRegisterIotDevicesUseCase;
  let registerDevice: RegisterIotDeviceUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Batch Owner" });
    useCase = testApp.module.get(BulkRegisterIotDevicesUseCase);
    registerDevice = testApp.module.get(RegisterIotDeviceUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);
    awsAdapter = testApp.module.get(AwsAdapter);

    // Echo the thing name back so every serial in a batch stays unique.
    vi.spyOn(awsAdapter, "createThing").mockImplementation((input) =>
      Promise.resolve(
        success({
          thingName: input.thingName,
          thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/${input.thingName}`,
        }),
      ),
    );
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("continues past a duplicate serial", async () => {
    const duplicate = "AA:00:00:00:00:01";
    const fresh = "AA:00:00:00:00:02";
    await registerDevice.execute({ serialNumber: duplicate, deviceType: "ambyte" }, userId);

    const result = await useCase.execute(
      {
        devices: [{ serialNumber: duplicate }, { serialNumber: fresh }],
        deviceType: "ambyte",
      },
      userId,
    );

    assertSuccess(result);
    expect(result.value.devices[0].device).toBeNull();
    expect(result.value.devices[0].error).toContain("already registered");
    expect(result.value.devices[1].device?.serialNumber).toBe(fresh);
    expect(result.value.devices[1].error).toBeNull();
  });

  it("creates a group around the batch when given a group name", async () => {
    const result = await useCase.execute(
      {
        devices: [{ serialNumber: "BB:00:00:00:00:01" }, { serialNumber: "BB:00:00:00:00:02" }],
        deviceType: "ambyte",
        group: { name: "Fresh batch" },
      },
      userId,
    );

    assertSuccess(result);
    expect(result.value.groupError).toBeNull();
    const groupId = result.value.groupId;
    if (groupId === null) {
      throw new Error("Expected a group to be created");
    }
    const group = await groupRepository.findById(groupId);
    assertSuccess(group);
    expect(group.value?.name).toBe("Fresh batch");
    expect(group.value?.memberCount).toBe(2);
  });

  it("reports a group error for a missing groupId while devices still register", async () => {
    const result = await useCase.execute(
      {
        devices: [{ serialNumber: "CC:00:00:00:00:01" }],
        deviceType: "ambyte",
        group: { groupId: faker.string.uuid() },
      },
      userId,
    );

    assertSuccess(result);
    expect(result.value.devices[0].device).not.toBeNull();
    expect(result.value.groupId).toBeNull();
    expect(result.value.groupError).toBe("Device group not found");
  });

  it("adds the batch to an existing group", async () => {
    const created = await createGroup.execute({ name: "Existing" }, userId);
    assertSuccess(created);

    const result = await useCase.execute(
      {
        devices: [{ serialNumber: "DD:00:00:00:00:01" }],
        deviceType: "ambyte",
        group: { groupId: created.value.id },
      },
      userId,
    );

    assertSuccess(result);
    expect(result.value.groupId).toBe(created.value.id);
    expect(result.value.groupError).toBeNull();
    const group = await groupRepository.findById(created.value.id);
    assertSuccess(group);
    expect(group.value?.memberCount).toBe(1);
  });

  it("reports when nothing registered, so the group is never touched", async () => {
    await registerDevice.execute({ serialNumber: "S-1", deviceType: "ambyte" }, userId);

    const result = await useCase.execute(
      { devices: [{ serialNumber: "S-1" }], deviceType: "ambyte", group: { name: "Never made" } },
      userId,
    );

    assertSuccess(result);
    expect(result.value.devices[0].device).toBeNull();
    expect(result.value.groupId).toBeNull();
    expect(result.value.groupError).toBe("No devices were registered, so no group was touched");
  });

  it("surfaces a group-creation failure as groupError, keeping the registrations", async () => {
    vi.spyOn(groupRepository, "create").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(
      { devices: [{ serialNumber: "S-1" }], deviceType: "ambyte", group: { name: "Doomed" } },
      userId,
    );

    assertSuccess(result);
    expect(result.value.devices[0].device).not.toBeNull();
    expect(result.value.groupId).toBeNull();
    expect(result.value.groupError).toBe("boom");
  });

  it("surfaces a membership-insert failure as groupError, keeping the registrations", async () => {
    vi.spyOn(groupRepository, "addMembers").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(
      { devices: [{ serialNumber: "S-1" }], deviceType: "ambyte", group: { name: "Half made" } },
      userId,
    );

    assertSuccess(result);
    expect(result.value.devices[0].device).not.toBeNull();
    expect(result.value.groupId).toBeNull();
    expect(result.value.groupError).toBe("boom");
  });
});
