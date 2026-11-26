import {
  eq,
  experimentDataOutbox,
  iotDevices,
  organizations,
  personalOrgSlug,
} from "@repo/database";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { EnsureMultispeqDeviceUseCase } from "./ensure-multispeq-device";

const SERIAL = "03:25:05:25";
const THING_NAME = `multispeq_${SERIAL}`;
const RETURNED_THING = {
  thingName: THING_NAME,
  thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/${THING_NAME}`,
};

describe("EnsureMultispeqDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: EnsureMultispeqDeviceUseCase;
  let repo: IotDeviceRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Researcher" });
    useCase = testApp.module.get(EnsureMultispeqDeviceUseCase);
    repo = testApp.module.get(IotDeviceRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "createThing").mockResolvedValue(success(RETURNED_THING));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("registers the unit under its canonical identity in the caller's personal organization", async () => {
    const result = await useCase.execute(
      { serialNumber: SERIAL, firmwareVersion: "2.345", name: "MultispeQ" },
      userId,
    );

    assertSuccess(result);
    expect(result.value.outcome).toBe("created");
    const device = result.value.device;
    expect(device).toMatchObject({
      serialNumber: SERIAL,
      deviceType: "multispeq",
      status: "registered",
      name: "MultispeQ",
      createdBy: userId,
    });

    const [org] = await testApp.database
      .select()
      .from(organizations)
      .where(eq(organizations.id, device?.organizationId ?? ""));
    expect(org.slug).toBe(personalOrgSlug(userId));
  });

  it("records how the identity was obtained on the Thing", async () => {
    const createThing = vi.spyOn(awsAdapter, "createThing");

    await useCase.execute({ serialNumber: SERIAL, firmwareVersion: "2.345" }, userId);

    expect(createThing).toHaveBeenCalledWith({
      thingName: THING_NAME,
      attributes: {
        deviceType: "multispeq",
        serialNumber: SERIAL,
        registeredVia: "mobile-connection",
        identitySource: "device_info",
        firmware: "2.345",
      },
    });
  });

  it("leaves the firmware attribute out when the device did not report one", async () => {
    const createThing = vi.spyOn(awsAdapter, "createThing");

    await useCase.execute({ serialNumber: SERIAL }, userId);

    expect(createThing.mock.calls[0][0].attributes).not.toHaveProperty("firmware");
  });

  it("owes the registry's lakehouse copy for a new unit only", async () => {
    const first = await useCase.execute({ serialNumber: SERIAL }, userId);
    await useCase.execute({ serialNumber: SERIAL }, userId);

    assertSuccess(first);
    expect(await testApp.database.select().from(experimentDataOutbox)).toEqual([
      expect.objectContaining({ recordType: "device", recordId: first.value.device?.id }),
    ]);
  });

  it("reuses the unit on a repeated connection by the same person", async () => {
    const createThing = vi.spyOn(awsAdapter, "createThing");

    const first = await useCase.execute({ serialNumber: SERIAL }, userId);
    const second = await useCase.execute({ serialNumber: SERIAL }, userId);

    assertSuccess(first);
    assertSuccess(second);
    expect(second.value.outcome).toBe("existing");
    expect(second.value.device?.id).toBe(first.value.device?.id);
    expect(createThing).toHaveBeenCalledTimes(1);
  });

  it("reuses a unit someone else registered without revealing it", async () => {
    const createThing = vi.spyOn(awsAdapter, "createThing");
    const otherUserId = await testApp.createTestUser({ name: "Colleague" });
    await useCase.execute({ serialNumber: SERIAL }, otherUserId);

    const result = await useCase.execute({ serialNumber: SERIAL }, userId);

    assertSuccess(result);
    expect(result.value).toEqual({ outcome: "existing", device: null });
    expect(createThing).toHaveBeenCalledTimes(1);
    const stored = await repo.findBySerialNumber(SERIAL);
    assertSuccess(stored);
    expect(stored.value?.createdBy).toBe(otherUserId);
  });

  it("does not bring a retired unit back into service", async () => {
    const first = await useCase.execute({ serialNumber: SERIAL }, userId);
    assertSuccess(first);
    await testApp.database
      .update(iotDevices)
      .set({ status: "retired" })
      .where(eq(iotDevices.serialNumber, SERIAL));

    const result = await useCase.execute({ serialNumber: SERIAL }, userId);

    assertSuccess(result);
    expect(result.value.outcome).toBe("existing");
    expect(result.value.device?.status).toBe("retired");
  });

  it("refuses an identity already held by a device of another family", async () => {
    const createThing = vi.spyOn(awsAdapter, "createThing");
    await testApp.database.insert(iotDevices).values({
      thingName: "generic_03-25-05-25",
      thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/generic_03-25-05-25",
      serialNumber: SERIAL,
      deviceType: "generic",
      createdBy: userId,
    });

    const result = await useCase.execute({ serialNumber: SERIAL }, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(409);
    expect(result.error.code).toBe(ErrorCodes.IOT_DEVICE_IDENTITY_COLLISION);
    expect(createThing).not.toHaveBeenCalled();
  });

  it("removes its Thing and keeps no row when the registry write fails", async () => {
    const deleteThing = vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
    vi.spyOn(repo, "create").mockRejectedValue(new Error("db unavailable"));

    assertFailure(await useCase.execute({ serialNumber: SERIAL }, userId));

    expect(deleteThing).toHaveBeenCalledWith(THING_NAME);
  });

  it("returns the winner's unit when a concurrent connection registered it first", async () => {
    const deleteThing = vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
    const otherUserId = await testApp.createTestUser({ name: "Colleague" });
    await useCase.execute({ serialNumber: SERIAL }, otherUserId);
    // The first lookup misses the colleague's row, as it would mid-race.
    vi.spyOn(repo, "findBySerialNumber").mockResolvedValueOnce(success(null));

    const result = await useCase.execute({ serialNumber: SERIAL }, userId);

    assertSuccess(result);
    expect(result.value).toEqual({ outcome: "existing", device: null });
    expect(deleteThing).not.toHaveBeenCalled();
  });
});
