import { faker } from "@faker-js/faker";

import { eq, iotDevices } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { CreateIotDeviceDto } from "../models/iot-device.model";
import { IotDeviceRepository } from "./iot-device.repository";

describe("IotDeviceRepository", () => {
  const testApp = TestHarness.App;
  let repository: IotDeviceRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "IotDevice Owner" });
    repository = testApp.module.get(IotDeviceRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const buildDto = (overrides: Partial<CreateIotDeviceDto> = {}): CreateIotDeviceDto => {
    const thingName = `generic_${faker.string.uuid()}`;
    return {
      thingName,
      thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/${thingName}`,
      serialNumber: faker.string.alphanumeric(12),
      name: "Test device",
      deviceType: "generic",
      ...overrides,
    };
  };

  it("creates a device and persists it", async () => {
    const dto = buildDto();

    const result = await repository.create(dto, userId);

    assertSuccess(result);
    const device = result.value[0];
    expect(device.serialNumber).toBe(dto.serialNumber);
    expect(device.status).toBe("pending");

    const rows = await testApp.database
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.id, device.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].createdBy).toBe(userId);
  });

  it("lists devices owned by a user", async () => {
    await repository.create(buildDto(), userId);
    await repository.create(buildDto(), userId);
    const otherUser = await testApp.createTestUser({});
    await repository.create(buildDto(), otherUser);

    const result = await repository.listByOwner(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
  });

  it("returns null from findById for a missing device", async () => {
    const result = await repository.findById(faker.string.uuid());

    assertSuccess(result);
    expect(result.value).toBeNull();
  });

  it("findById is not owner-scoped (authorization is enforced by the @CanAccess guard)", async () => {
    const created = await repository.create(buildDto(), userId);
    assertSuccess(created);

    const result = await repository.findById(created.value[0].id);

    assertSuccess(result);
    expect(result.value?.id).toBe(created.value[0].id);
  });

  it("finds a device by serial number", async () => {
    const dto = buildDto();
    await repository.create(dto, userId);

    const result = await repository.findBySerialNumber(dto.serialNumber);

    assertSuccess(result);
    expect(result.value?.serialNumber).toBe(dto.serialNumber);
  });

  it("resolves thing names to registry rows across owners", async () => {
    const otherUser = await testApp.createTestUser({ name: "Other Owner" });
    const mine = buildDto();
    const theirs = buildDto();
    await repository.create(mine, userId);
    await repository.create(theirs, otherUser);

    const result = await repository.findByThingNames([mine.thingName, theirs.thingName, "missing"]);

    assertSuccess(result);
    expect(result.value.map((d) => d.thingName).sort()).toEqual(
      [mine.thingName, theirs.thingName].sort(),
    );
  });

  it("returns an empty list without querying for an empty batch", async () => {
    const result = await repository.findByThingNames([]);

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("deletes a device", async () => {
    const created = await repository.create(buildDto(), userId);
    assertSuccess(created);

    const del = await repository.delete(created.value[0].id);

    assertSuccess(del);
    const rows = await testApp.database
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.id, created.value[0].id));
    expect(rows).toHaveLength(0);
  });
});
