import {
  IoTClient,
  CreateThingCommand,
  DeleteThingCommand,
  AddThingToThingGroupCommand,
} from "@aws-sdk/client-iot";
import { mockClient } from "aws-sdk-client-mock";

import { TestHarness } from "../../../../../test/test-harness";
import { ErrorCodes } from "../../../../utils/error-codes";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import { AwsIotService } from "./iot.service";

const iotMock = mockClient(IoTClient);

describe("AwsIotService", () => {
  const testApp = TestHarness.App;
  let service: AwsIotService;
  let awsConfig: AwsConfigService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    iotMock.reset();
    await testApp.beforeEach();
    service = testApp.module.get(AwsIotService);
    awsConfig = testApp.module.get(AwsConfigService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createThing", () => {
    const input = {
      thingName: "AMBYTE_E8:F6:0A:B1:1D:D4",
      attributes: { serialNumber: "E8:F6:0A:B1:1D:D4", deviceType: "ambyte" },
    };

    it("creates the thing, adds it to the group, and returns name + arn", async () => {
      iotMock.on(CreateThingCommand).resolves({
        thingName: input.thingName,
        thingArn: "arn:aws:iot:eu-central-1:123456789012:thing/AMBYTE_E8:F6:0A:B1:1D:D4",
      });
      iotMock.on(AddThingToThingGroupCommand).resolves({});

      const result = await service.createThing(input);

      assertSuccess(result);
      expect(result.value).toEqual({
        thingName: input.thingName,
        thingArn: "arn:aws:iot:eu-central-1:123456789012:thing/AMBYTE_E8:F6:0A:B1:1D:D4",
      });

      const createCall = iotMock.commandCalls(CreateThingCommand)[0].args[0].input;
      expect(createCall).toMatchObject({
        thingName: input.thingName,
        thingTypeName: awsConfig.deviceThingTypeName,
        attributePayload: { attributes: input.attributes },
      });

      const groupCall = iotMock.commandCalls(AddThingToThingGroupCommand)[0].args[0].input;
      expect(groupCall).toMatchObject({
        thingName: input.thingName,
        thingGroupName: awsConfig.deviceThingGroupName,
      });
    });

    it("fails and skips group attachment when CreateThing returns an incomplete response", async () => {
      iotMock.on(CreateThingCommand).resolves({ thingName: input.thingName });

      const result = await service.createThing(input);

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_CREATE_THING_FAILED);
      expect(iotMock.commandCalls(AddThingToThingGroupCommand)).toHaveLength(0);
    });

    it("maps an SDK error to a create-thing failure", async () => {
      iotMock.on(CreateThingCommand).rejects(new Error("throttled"));

      const result = await service.createThing(input);

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_CREATE_THING_FAILED);
      expect(result.error.message).toContain("throttled");
    });
  });

  describe("deleteThing", () => {
    it("deletes the thing and returns success", async () => {
      iotMock.on(DeleteThingCommand).resolves({});

      const result = await service.deleteThing("AMBYTE_E8:F6:0A:B1:1D:D4");

      assertSuccess(result);
      expect(iotMock.commandCalls(DeleteThingCommand)[0].args[0].input).toEqual({
        thingName: "AMBYTE_E8:F6:0A:B1:1D:D4",
      });
    });

    it("maps an SDK error to a delete-thing failure", async () => {
      iotMock.on(DeleteThingCommand).rejects(new Error("not found"));

      const result = await service.deleteThing("missing-thing");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_DELETE_THING_FAILED);
      expect(result.error.message).toContain("not found");
    });
  });
});
