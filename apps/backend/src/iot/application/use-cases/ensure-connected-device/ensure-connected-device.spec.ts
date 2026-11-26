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
import { EnsureConnectedDeviceUseCase } from "./ensure-connected-device";

const MAC = "58:CF:79:12:34:56";
const ADDRESS = "98:D3:31:03:25:05";

describe("EnsureConnectedDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: EnsureConnectedDeviceUseCase;
  let repo: IotDeviceRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Researcher" });
    useCase = testApp.module.get(EnsureConnectedDeviceUseCase);
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

  it.each(["ambit", "minipar", "co2dot"] as const)(
    "registers a %s by its MAC in the caller's personal organization",
    async (family) => {
      const result = await useCase.execute(
        { family, serialNumber: MAC, firmwareVersion: "1.07", name: "Bench unit" },
        userId,
      );

      assertSuccess(result);
      expect(result.value.outcome).toBe("created");
      const device = result.value.device;
      expect(device).toMatchObject({
        serialNumber: MAC,
        deviceType: family,
        status: "registered",
        name: "Bench unit",
        thingName: `${family}_${MAC}`,
        thingArn: null,
        createdBy: userId,
      });

      const [org] = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.id, device?.organizationId ?? ""));
      expect(org.slug).toBe(personalOrgSlug(userId));
    },
  );

  it("registers a MultispeQ by its full Bluetooth address", async () => {
    const result = await useCase.execute(
      { family: "multispeq", serialNumber: ADDRESS, reportedId: "31:03:25:05" },
      userId,
    );

    assertSuccess(result);
    expect(result.value.device).toMatchObject({
      serialNumber: ADDRESS,
      deviceType: "multispeq",
      thingName: `multispeq_${ADDRESS}`,
    });
  });

  it("creates no AWS thing: issuing credentials does (decision 2)", async () => {
    const createThing = vi.spyOn(awsAdapter, "createThing");

    assertSuccess(await useCase.execute({ family: "ambit", serialNumber: MAC }, userId));

    expect(createThing).not.toHaveBeenCalled();
  });

  it("owes the registry's lakehouse copy for a new unit only", async () => {
    const first = await useCase.execute({ family: "ambit", serialNumber: MAC }, userId);
    await useCase.execute({ family: "ambit", serialNumber: MAC }, userId);

    assertSuccess(first);
    expect(await testApp.database.select().from(experimentDataOutbox)).toEqual([
      expect.objectContaining({ recordType: "device", recordId: first.value.device?.id }),
    ]);
  });

  it("reuses the unit on a repeated connection by the same person", async () => {
    const first = await useCase.execute({ family: "minipar", serialNumber: MAC }, userId);
    const second = await useCase.execute({ family: "minipar", serialNumber: MAC }, userId);

    assertSuccess(first);
    assertSuccess(second);
    expect(second.value.outcome).toBe("existing");
    expect(second.value.device?.id).toBe(first.value.device?.id);
  });

  it("matches a unit registered on the web with another separator or letter case", async () => {
    await testApp.database.insert(iotDevices).values({
      thingName: "ambit_58cf79123456",
      thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/ambit_58cf79123456",
      serialNumber: "58cf79123456",
      deviceType: "ambit",
      createdBy: userId,
    });

    const result = await useCase.execute({ family: "ambit", serialNumber: MAC }, userId);

    assertSuccess(result);
    expect(result.value.outcome).toBe("existing");
    expect(result.value.device?.serialNumber).toBe("58cf79123456");
  });

  it("reuses a unit someone else registered without revealing it", async () => {
    const otherUserId = await testApp.createTestUser({ name: "Colleague" });
    await useCase.execute({ family: "co2dot", serialNumber: MAC }, otherUserId);

    const result = await useCase.execute({ family: "co2dot", serialNumber: MAC }, userId);

    assertSuccess(result);
    expect(result.value).toEqual({ outcome: "existing", device: null });
    const stored = await repo.findBySerialNumber(MAC);
    assertSuccess(stored);
    expect(stored.value?.createdBy).toBe(otherUserId);
  });

  it("does not bring a retired unit back into service", async () => {
    assertSuccess(await useCase.execute({ family: "ambit", serialNumber: MAC }, userId));
    await testApp.database
      .update(iotDevices)
      .set({ status: "retired" })
      .where(eq(iotDevices.serialNumber, MAC));

    const result = await useCase.execute({ family: "ambit", serialNumber: MAC }, userId);

    assertSuccess(result);
    expect(result.value.outcome).toBe("existing");
    expect(result.value.device?.status).toBe("retired");
  });

  it("refuses a serial already held by a device of another family", async () => {
    assertSuccess(await useCase.execute({ family: "ambit", serialNumber: MAC }, userId));

    const result = await useCase.execute({ family: "minipar", serialNumber: MAC }, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(409);
    expect(result.error.code).toBe(ErrorCodes.IOT_DEVICE_IDENTITY_COLLISION);
  });

  it("keeps no row when the registry write fails", async () => {
    vi.spyOn(repo, "create").mockRejectedValue(new Error("db unavailable"));

    assertFailure(await useCase.execute({ family: "ambit", serialNumber: MAC }, userId));

    const stored = await repo.findBySerialNumber(MAC);
    assertSuccess(stored);
    expect(stored.value).toBeNull();
  });

  it("returns the winner's unit when a concurrent connection registered it first", async () => {
    const otherUserId = await testApp.createTestUser({ name: "Colleague" });
    await useCase.execute({ family: "ambit", serialNumber: MAC }, otherUserId);
    // The first lookup misses the colleague's row, as it would mid-race.
    vi.spyOn(repo, "findBySerialNumberNormalized").mockResolvedValueOnce(success(null));

    const result = await useCase.execute({ family: "ambit", serialNumber: MAC }, userId);

    assertSuccess(result);
    expect(result.value).toEqual({ outcome: "existing", device: null });
  });
});
