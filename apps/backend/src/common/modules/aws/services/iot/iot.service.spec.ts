import {
  IoTClient,
  CreateThingCommand,
  DeleteThingCommand,
  AddThingToThingGroupCommand,
  CreateKeysAndCertificateCommand,
  AttachThingPrincipalCommand,
  DetachThingPrincipalCommand,
  AttachPolicyCommand,
  UpdateCertificateCommand,
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

  describe("createKeysAndCertificate", () => {
    it("returns the id, arn, pem, and private key", async () => {
      iotMock.on(CreateKeysAndCertificateCommand).resolves({
        certificateId: "cert-1",
        certificateArn: "arn:aws:iot:eu-central-1:123456789012:cert/cert-1",
        certificatePem: "PEM",
        keyPair: { PrivateKey: "KEY", PublicKey: "PUB" },
      });

      const result = await service.createKeysAndCertificate();

      assertSuccess(result);
      expect(result.value).toEqual({
        certificateId: "cert-1",
        certificateArn: "arn:aws:iot:eu-central-1:123456789012:cert/cert-1",
        certificatePem: "PEM",
        publicKey: "PUB",
        privateKey: "KEY",
      });
      expect(iotMock.commandCalls(CreateKeysAndCertificateCommand)[0].args[0].input).toEqual({
        setAsActive: true,
      });
    });

    it("fails when the certificate response is incomplete", async () => {
      iotMock.on(CreateKeysAndCertificateCommand).resolves({
        certificateId: "cert-1",
        certificateArn: "arn:cert",
        certificatePem: "PEM",
      });

      const result = await service.createKeysAndCertificate();

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_CREATE_CERT_FAILED);
    });
  });

  describe("attachThingPrincipal / detachThingPrincipal", () => {
    it("attaches the certificate principal to the thing", async () => {
      iotMock.on(AttachThingPrincipalCommand).resolves({});

      const result = await service.attachThingPrincipal("thing-1", "arn:cert");

      assertSuccess(result);
      expect(iotMock.commandCalls(AttachThingPrincipalCommand)[0].args[0].input).toEqual({
        thingName: "thing-1",
        principal: "arn:cert",
      });
    });

    it("detaches the certificate principal from the thing", async () => {
      iotMock.on(DetachThingPrincipalCommand).resolves({});

      const result = await service.detachThingPrincipal("thing-1", "arn:cert");

      assertSuccess(result);
      expect(iotMock.commandCalls(DetachThingPrincipalCommand)[0].args[0].input).toEqual({
        thingName: "thing-1",
        principal: "arn:cert",
      });
    });

    it("maps an SDK error to an attach-principal failure", async () => {
      iotMock.on(AttachThingPrincipalCommand).rejects(new Error("nope"));

      const result = await service.attachThingPrincipal("thing-1", "arn:cert");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_ATTACH_PRINCIPAL_FAILED);
    });
  });

  describe("attachPolicy", () => {
    it("attaches a policy to the certificate", async () => {
      iotMock.on(AttachPolicyCommand).resolves({});

      const result = await service.attachPolicy("policy-1", "arn:cert");

      assertSuccess(result);
      expect(iotMock.commandCalls(AttachPolicyCommand)[0].args[0].input).toEqual({
        policyName: "policy-1",
        target: "arn:cert",
      });
    });

    it("maps an SDK error to an attach-cert-policy failure", async () => {
      iotMock.on(AttachPolicyCommand).rejects(new Error("nope"));

      const result = await service.attachPolicy("policy-1", "arn:cert");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_ATTACH_CERT_POLICY_FAILED);
    });
  });

  describe("updateCertificateStatus", () => {
    it("sets the certificate status", async () => {
      iotMock.on(UpdateCertificateCommand).resolves({});

      const result = await service.updateCertificateStatus("cert-1", "REVOKED");

      assertSuccess(result);
      expect(iotMock.commandCalls(UpdateCertificateCommand)[0].args[0].input).toEqual({
        certificateId: "cert-1",
        newStatus: "REVOKED",
      });
    });

    it("maps an SDK error to an update-cert failure", async () => {
      iotMock.on(UpdateCertificateCommand).rejects(new Error("nope"));

      const result = await service.updateCertificateStatus("cert-1", "INACTIVE");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_UPDATE_CERT_FAILED);
    });
  });
});
