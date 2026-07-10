import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
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

  const body = { serialNumber: "E8:F6:0A:B1:1D:D4", name: "Sensor 1", deviceType: "ambyte" };

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
    expect(result.value.status).toBe("pending");
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
    vi.spyOn(repo, "create").mockResolvedValue(failure(AppError.internal("DB error")));

    const result = await useCase.execute(body, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    expect(createSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith(RETURNED_THING.thingName);
    vi.restoreAllMocks();
  });
});
