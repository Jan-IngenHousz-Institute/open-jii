import { experimentDataOutbox } from "@repo/database";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { AppError, assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { RegisterIotDeviceUseCase } from "./register-iot-device";

const RETURNED_THING = {
  thingName: "ambyte_E8:F6:0A:B1:1D:D4",
  thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/ambyte_E8:F6:0A:B1:1D:D4",
};

describe("RegisterIotDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RegisterIotDeviceUseCase;
  let repo: IotDeviceRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  const body = {
    serialNumber: "E8:F6:0A:B1:1D:D4",
    name: "Sensor 1",
    deviceType: "ambyte" as const,
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(RegisterIotDeviceUseCase);
    repo = testApp.module.get(IotDeviceRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const mockCreateThing = () =>
    vi.spyOn(awsAdapter, "createThing").mockResolvedValue(success(RETURNED_THING));

  it("registers a device and stores the real thing details", async () => {
    const spy = mockCreateThing();

    const result = await useCase.execute(body, userId);

    assertSuccess(result);
    expect(result.value.thingName).toBe(RETURNED_THING.thingName);
    expect(result.value.thingArn).toBe(RETURNED_THING.thingArn);
    expect(result.value.serialNumber).toBe(body.serialNumber);
    expect(result.value.status).toBe("registered");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: { deviceType: "ambyte", serialNumber: body.serialNumber },
      }),
    );
  });

  it("returns 409 when the serial number is already registered", async () => {
    mockCreateThing();
    await useCase.execute(body, userId);

    const result = await useCase.execute(body, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(409);
  });

  it("rolls back the Thing when the DB insert fails", async () => {
    const createSpy = mockCreateThing();
    const deleteSpy = vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
    vi.spyOn(repo, "create").mockRejectedValue(AppError.internal("DB error"));

    const result = await useCase.execute(body, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    expect(createSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith(RETURNED_THING.thingName);
    vi.restoreAllMocks();
  });

  describe("the registry's lakehouse copy", () => {
    const owed = () => testApp.database.select().from(experimentDataOutbox);

    it("is owed a registered device in the same transaction, and the worker nudged", async () => {
      mockCreateThing();
      const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

      const result = await useCase.execute(body, userId);

      assertSuccess(result);
      expect(await owed()).toEqual([
        expect.objectContaining({
          recordType: "device",
          recordId: result.value.id,
          experimentId: null,
          destination: "lakehouse",
        }),
      ]);
      expect(nudge).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
    });

    it("keeps no device, and removes its Thing, when the copy it owes cannot be written", async () => {
      mockCreateThing();
      const deleteThing = vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
      vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "owe").mockRejectedValue(
        new Error("outbox unavailable"),
      );
      const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

      assertFailure(await useCase.execute(body, userId));

      const stored = await repo.findBySerialNumber(body.serialNumber);
      assertSuccess(stored);
      expect(stored.value).toBeNull();
      expect(deleteThing).toHaveBeenCalledWith(RETURNED_THING.thingName);
      expect(nudge).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });
});
