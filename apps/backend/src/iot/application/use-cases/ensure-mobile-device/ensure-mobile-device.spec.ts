import {
  AddThingToThingGroupCommand,
  CreateThingCommand,
  DeleteThingCommand,
  DescribeThingCommand,
  IoTClient,
  ListThingPrincipalsCommand,
  ResourceAlreadyExistsException,
  UpdateThingCommand,
} from "@aws-sdk/client-iot";
import { mockClient } from "aws-sdk-client-mock";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { AwsConfigService } from "../../../../common/modules/aws/services/config/config.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { EnsureMobileDeviceUseCase } from "./ensure-mobile-device";

const INSTALL_ID = "9f2c1a2e-1111-4111-8111-111111111111";
const THING_NAME = `mobile_${INSTALL_ID}`;
const RETURNED_THING = {
  thingName: THING_NAME,
  thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/${THING_NAME}`,
};
const IDENTITY_ID = "eu-central-1:cognito-identity-1";

describe("EnsureMobileDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: EnsureMobileDeviceUseCase;
  let repo: IotDeviceRepository;
  let awsAdapter: AwsAdapter;
  let userId: string;

  const body = { installId: INSTALL_ID, name: "iPhone 15" };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(EnsureMobileDeviceUseCase);
    repo = testApp.module.get(IotDeviceRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "createThing").mockResolvedValue(success(RETURNED_THING));
    vi.spyOn(awsAdapter, "getCognitoIdentityId").mockResolvedValue(success(IDENTITY_ID));
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("creates an active mobile device and binds the caller's Cognito identity", async () => {
    const attach = vi.spyOn(awsAdapter, "attachThingPrincipal");

    const result = await useCase.execute(body, userId);

    assertSuccess(result);
    expect(result.value.thingName).toBe(THING_NAME);
    expect(result.value.serialNumber).toBe(INSTALL_ID);
    expect(result.value.deviceType).toBe("mobile");
    expect(result.value.status).toBe("active");
    expect(result.value.name).toBe("iPhone 15");
    expect(attach).toHaveBeenCalledWith(THING_NAME, IDENTITY_ID);
  });

  it("is idempotent: a second ensure returns the same row and re-attaches", async () => {
    const createThing = vi.spyOn(awsAdapter, "createThing");
    const attach = vi.spyOn(awsAdapter, "attachThingPrincipal");

    const first = await useCase.execute(body, userId);
    const second = await useCase.execute(body, userId);

    assertSuccess(first);
    assertSuccess(second);
    expect(second.value.id).toBe(first.value.id);
    expect(createThing).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledTimes(2);
  });

  it("returns a retired phone as retired without healing it back onto the broker", async () => {
    const attach = vi.spyOn(awsAdapter, "attachThingPrincipal");
    const first = await useCase.execute(body, userId);
    assertSuccess(first);
    const repo = testApp.module.get(IotDeviceRepository);
    assertSuccess(await repo.update(first.value.id, { status: "retired" }));
    attach.mockClear();

    const second = await useCase.execute(body, userId);

    assertSuccess(second);
    expect(second.value.id).toBe(first.value.id);
    expect(second.value.status).toBe("retired");
    expect(attach).not.toHaveBeenCalled();
  });

  it("fills a missing name on a later ensure, but never overwrites one", async () => {
    const first = await useCase.execute({ installId: body.installId }, userId);
    assertSuccess(first);
    expect(first.value.name).toBeNull();

    const named = await useCase.execute({ installId: body.installId, name: "iPhone 15" }, userId);
    assertSuccess(named);
    expect(named.value.name).toBe("iPhone 15");

    // An existing name may be the user's own rename; the device model loses.
    const renamedAgain = await useCase.execute(
      { installId: body.installId, name: "iPhone 16" },
      userId,
    );
    assertSuccess(renamedAgain);
    expect(renamedAgain.value.name).toBe("iPhone 15");
  });

  it("returns the row unrenamed when the name fill fails", async () => {
    const first = await useCase.execute({ installId: body.installId }, userId);
    assertSuccess(first);
    const spy = vi
      .spyOn(repo, "fillNameIfMissing")
      .mockResolvedValue(failure(AppError.internal("db down")));

    const result = await useCase.execute({ installId: body.installId, name: "iPhone 15" }, userId);

    expect(spy).toHaveBeenCalledTimes(1);
    assertSuccess(result);
    expect(result.value.name).toBeNull();
  });

  it("keeps the Thing when the insert returns no row at all", async () => {
    const deleteThing = vi.spyOn(awsAdapter, "deleteThing");
    vi.spyOn(repo, "create").mockResolvedValue(success([]));

    const result = await useCase.execute(body, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    expect(deleteThing).not.toHaveBeenCalled();
  });

  it("loses the name race to a concurrent rename and returns the fresher row", async () => {
    const first = await useCase.execute({ installId: body.installId }, userId);
    assertSuccess(first);
    // A rename lands between the null read and the fill: the conditional
    // update must not apply.
    await repo.update(first.value.id, { name: "Field phone 3" });

    const result = await useCase.execute({ installId: body.installId, name: "iPhone 15" }, userId);

    assertSuccess(result);
    expect(result.value.name).toBe("Field phone 3");
  });

  it("returns 409 without leaking the owner when another user holds the install id", async () => {
    await useCase.execute(body, userId);
    const otherUser = await testApp.createTestUser({ name: "Other" });

    const result = await useCase.execute(body, otherUser);

    assertFailure(result);
    expect(result.error.statusCode).toBe(409);
    expect(result.error.code).toBe(ErrorCodes.IOT_DEVICE_OWNED_BY_ANOTHER_USER);
    expect(result.error.message).not.toContain(userId);
  });

  it("still succeeds when the identity binding cannot be established", async () => {
    vi.spyOn(awsAdapter, "getCognitoIdentityId").mockResolvedValue(
      failure(AppError.internal("cognito down")),
    );

    const result = await useCase.execute(body, userId);

    assertSuccess(result);
    expect(result.value.status).toBe("active");
  });

  it("keeps the Thing when the row cannot be persisted", async () => {
    const deleteThing = vi.spyOn(awsAdapter, "deleteThing");
    vi.spyOn(repo, "create").mockResolvedValue(failure(AppError.internal("db down")));

    const result = await useCase.execute(body, userId);

    assertFailure(result);
    expect(deleteThing).not.toHaveBeenCalled();
  });

  it("resolves a create race to the winning row", async () => {
    // Simulate losing the unique-constraint race: create fails, but the row
    // exists by the time the rollback path re-checks.
    const winner = await useCase.execute(body, userId);
    assertSuccess(winner);

    const deleteThing = vi.spyOn(awsAdapter, "deleteThing");
    // One mocked miss; later calls fall through to the real repository.
    vi.spyOn(repo, "findBySerialNumber").mockResolvedValueOnce(success(null));
    vi.spyOn(repo, "create").mockResolvedValue(
      failure(AppError.internal("duplicate key value violates unique constraint")),
    );

    const result = await useCase.execute(body, userId);

    assertSuccess(result);
    expect(result.value.id).toBe(winner.value.id);
    expect(deleteThing).not.toHaveBeenCalled();
  });

  // Runs the real adapter and IoT service against a mocked SDK, so adoption,
  // the in-use check and the failure path are exercised together.
  describe("when the thing already existed in AWS", () => {
    const iotMock = mockClient(IoTClient);
    const thingName = THING_NAME;
    const thingArn = `arn:aws:iot:eu-central-1:000000000000:thing/${thingName}`;
    const legacyConflict = new ResourceAlreadyExistsException({
      message: "different configuration",
      $metadata: {},
      resourceId: thingName,
    });

    beforeEach(() => {
      iotMock.reset();
      vi.spyOn(awsAdapter, "createThing").mockRestore();
      const awsConfig = testApp.module.get(AwsConfigService);
      iotMock.on(AddThingToThingGroupCommand).resolves({});
      iotMock.on(UpdateThingCommand).resolves({});
      iotMock.on(DeleteThingCommand).resolves({});
      iotMock.on(DescribeThingCommand).resolves({
        thingName,
        thingArn,
        thingTypeName: awsConfig.deviceThingTypeName,
        attributes: { deviceType: "mobile", serialNumber: INSTALL_ID },
        version: 1,
      });
      iotMock.on(ListThingPrincipalsCommand).resolves({ principals: [] });
    });

    afterAll(() => {
      iotMock.restore();
    });

    it("never deletes the thing when the device row cannot be stored, across retries", async () => {
      // Attempt 1 adopts the legacy thing and writes its id. Attempt 2 then
      // matches it exactly, so CreateThing succeeds idempotently.
      iotMock.on(CreateThingCommand).rejectsOnce(legacyConflict).resolves({ thingName, thingArn });
      vi.spyOn(repo, "create").mockResolvedValue(failure(AppError.internal("DB error")));

      const first = await useCase.execute(body, userId);
      const second = await useCase.execute(body, userId);

      assertFailure(first);
      assertFailure(second);
      expect(iotMock.commandCalls(CreateThingCommand)).toHaveLength(2);
      expect(iotMock.commandCalls(UpdateThingCommand)).toHaveLength(1);
      expect(iotMock.commandCalls(DeleteThingCommand)).toHaveLength(0);
    });

    it("refuses a thing that already has credentials attached", async () => {
      iotMock.on(CreateThingCommand).resolves({ thingName, thingArn });
      iotMock
        .on(ListThingPrincipalsCommand)
        .resolves({ principals: ["arn:aws:iot:eu-central-1:000000000000:cert/live"] });
      const createRow = vi.spyOn(repo, "create");

      const result = await useCase.execute(body, userId);

      assertFailure(result);
      expect(result.error.statusCode).toBe(409);
      expect(createRow).not.toHaveBeenCalled();
      expect(iotMock.commandCalls(DeleteThingCommand)).toHaveLength(0);
    });
  });
});
