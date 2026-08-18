import { faker } from "@faker-js/faker";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { IotDeviceGroupRepository } from "./iot-device-group.repository";

describe("IotDeviceGroupRepository", () => {
  const testApp = TestHarness.App;
  let repository: IotDeviceGroupRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Group Owner" });
    repository = testApp.module.get(IotDeviceGroupRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const createGroup = async (ownerId: string) => {
    const created = await repository.create(
      { name: `Group ${faker.string.uuid()}`, description: null },
      ownerId,
    );
    assertSuccess(created);
    return created.value[0];
  };

  it("shows the creator their group and hides it from a stranger", async () => {
    const group = await createGroup(userId);
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    const own = await repository.listAccessible(userId);
    assertSuccess(own);
    expect(own.value.map((row) => row.id)).toContain(group.id);

    const foreign = await repository.listAccessible(stranger);
    assertSuccess(foreign);
    expect(foreign.value.map((row) => row.id)).not.toContain(group.id);
  });

  it("counts members per group after addMembers", async () => {
    const populated = await createGroup(userId);
    const empty = await createGroup(userId);
    const first = await testApp.createIotDevice({ createdBy: userId });
    const second = await testApp.createIotDevice({ createdBy: userId });
    assertSuccess(await repository.addMembers(populated.id, [first.id, second.id], userId));

    const populatedRow = await repository.findById(populated.id);
    assertSuccess(populatedRow);
    expect(populatedRow.value?.memberCount).toBe(2);

    const emptyRow = await repository.findById(empty.id);
    assertSuccess(emptyRow);
    expect(emptyRow.value?.memberCount).toBe(0);
  });

  it("filters existingDeviceIds down to devices that exist", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await repository.existingDeviceIds([device.id, faker.string.uuid()]);

    assertSuccess(result);
    expect(result.value).toEqual([device.id]);
  });
});
