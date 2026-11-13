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
  DescribeEndpointCommand,
  DescribeThingCommand,
  UpdateThingCommand,
  ListThingPrincipalsCommand,
  SearchIndexCommand,
  InvalidRequestException,
  ResourceAlreadyExistsException,
  VersionConflictException,
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

  describe("ensureDeviceLocationId", () => {
    const thingName = "ambyte_28:37:2F:FF:E7:04";

    it("sets a missing attribute, merged and version-guarded", async () => {
      iotMock
        .on(DescribeThingCommand)
        .resolves({ attributes: { deviceType: "ambyte" }, version: 4 });
      iotMock.on(UpdateThingCommand).resolves({});

      const result = await service.ensureDeviceLocationId(thingName);

      assertSuccess(result);
      expect(result.value).toBe("set");
      expect(iotMock.commandCalls(UpdateThingCommand)[0].args[0].input).toEqual({
        thingName,
        expectedVersion: 4,
        attributePayload: {
          attributes: { deviceLocationId: "ambyte-5F28-3A37-3A2F-3AFF-3AE7-3A04" },
          merge: true,
        },
      });
    });

    it("writes nothing when the attribute already matches", async () => {
      iotMock.on(DescribeThingCommand).resolves({
        attributes: { deviceLocationId: "ambyte-5F28-3A37-3A2F-3AFF-3AE7-3A04" },
        version: 4,
      });

      const result = await service.ensureDeviceLocationId(thingName);

      assertSuccess(result);
      expect(result.value).toBe("unchanged");
      expect(iotMock.commandCalls(UpdateThingCommand)).toHaveLength(0);
    });

    it("keeps a differing attribute and reports the conflict", async () => {
      iotMock.on(DescribeThingCommand).resolves({ attributes: { deviceLocationId: "hand-set" } });

      const result = await service.ensureDeviceLocationId(thingName);

      assertSuccess(result);
      expect(result.value).toBe("conflict");
      expect(iotMock.commandCalls(UpdateThingCommand)).toHaveLength(0);
    });

    it("retries once against a fresh read when the thing changed in between", async () => {
      iotMock
        .on(DescribeThingCommand)
        .resolvesOnce({ attributes: {}, version: 1 })
        .resolves({ attributes: { serialNumber: "x" }, version: 2 });
      iotMock
        .on(UpdateThingCommand)
        .rejectsOnce(new VersionConflictException({ message: "stale", $metadata: {} }))
        .resolves({});

      const result = await service.ensureDeviceLocationId(thingName);

      assertSuccess(result);
      expect(result.value).toBe("set");
      const updates = iotMock.commandCalls(UpdateThingCommand);
      expect(updates.map((call) => call.args[0].input.expectedVersion)).toEqual([1, 2]);
    });

    it("gives up after a second version conflict", async () => {
      iotMock.on(DescribeThingCommand).resolves({ attributes: {}, version: 1 });
      iotMock
        .on(UpdateThingCommand)
        .rejects(new VersionConflictException({ message: "stale", $metadata: {} }));

      const result = await service.ensureDeviceLocationId(thingName);

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_UPDATE_THING_FAILED);
      expect(iotMock.commandCalls(UpdateThingCommand)).toHaveLength(2);
    });

    it("reports a thing name with no id without calling AWS", async () => {
      const result = await service.ensureDeviceLocationId("a".repeat(129));

      assertSuccess(result);
      expect(result.value).toBe("unsupported");
      expect(iotMock.calls()).toHaveLength(0);
    });

    it("maps an SDK error to an update-thing failure", async () => {
      iotMock.on(DescribeThingCommand).resolves({ attributes: {}, version: 1 });
      iotMock.on(UpdateThingCommand).rejects(new Error("throttled"));

      const result = await service.ensureDeviceLocationId(thingName);

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_UPDATE_THING_FAILED);
    });
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
      });
      expect(createCall.attributePayload?.attributes).toEqual({
        ...input.attributes,
        deviceLocationId: "AMBYTE-5FE8-3AF6-3A0A-3AB1-3A1D-3AD4",
      });

      const groupCall = iotMock.commandCalls(AddThingToThingGroupCommand)[0].args[0].input;
      expect(groupCall).toMatchObject({
        thingName: input.thingName,
        thingGroupName: awsConfig.deviceThingGroupName,
      });
    });

    it("omits the attribute for a thing name with no id", async () => {
      const longName = "a".repeat(129);
      iotMock.on(CreateThingCommand).resolves({ thingName: longName, thingArn: "arn:thing" });
      iotMock.on(AddThingToThingGroupCommand).resolves({});

      const result = await service.createThing({ ...input, thingName: longName });

      assertSuccess(result);
      const createCall = iotMock.commandCalls(CreateThingCommand)[0].args[0].input;
      expect(createCall.attributePayload?.attributes).toEqual(input.attributes);
    });

    describe("when the thing already exists", () => {
      const conflict = new ResourceAlreadyExistsException({
        message: "different configuration",
        $metadata: {},
        resourceId: input.thingName,
      });
      const existingArn = "arn:aws:iot:eu-central-1:123456789012:thing/AMBYTE_E8:F6:0A:B1:1D:D4";

      it("adopts a thing made before the attribute existed and gives it the id", async () => {
        iotMock.on(CreateThingCommand).rejects(conflict);
        iotMock.on(DescribeThingCommand).resolves({
          thingName: input.thingName,
          thingArn: existingArn,
          thingTypeName: awsConfig.deviceThingTypeName,
          attributes: input.attributes,
          version: 3,
        });
        iotMock.on(UpdateThingCommand).resolves({});
        iotMock.on(AddThingToThingGroupCommand).resolves({});

        const result = await service.createThing(input);

        assertSuccess(result);
        expect(result.value).toEqual({ thingName: input.thingName, thingArn: existingArn });
        expect(iotMock.commandCalls(UpdateThingCommand)[0].args[0].input).toMatchObject({
          thingName: input.thingName,
          attributePayload: {
            attributes: { deviceLocationId: "AMBYTE-5FE8-3AF6-3A0A-3AB1-3A1D-3AD4" },
          },
        });
        expect(iotMock.commandCalls(AddThingToThingGroupCommand)).toHaveLength(1);
      });

      it("keeps the original error when the existing thing is a different device", async () => {
        iotMock.on(CreateThingCommand).rejects(conflict);
        iotMock.on(DescribeThingCommand).resolves({
          thingName: input.thingName,
          thingArn: existingArn,
          thingTypeName: awsConfig.deviceThingTypeName,
          attributes: { ...input.attributes, serialNumber: "something-else" },
        });

        const result = await service.createThing(input);

        assertFailure(result);
        expect(result.error.code).toBe(ErrorCodes.AWS_IOT_CREATE_THING_FAILED);
        expect(result.error.message).toContain("different configuration");
        expect(iotMock.commandCalls(UpdateThingCommand)).toHaveLength(0);
        expect(iotMock.commandCalls(AddThingToThingGroupCommand)).toHaveLength(0);
      });

      it("keeps the original error when the existing thing has another type", async () => {
        iotMock.on(CreateThingCommand).rejects(conflict);
        iotMock.on(DescribeThingCommand).resolves({
          thingName: input.thingName,
          thingArn: existingArn,
          attributes: input.attributes,
        });

        const result = await service.createThing(input);

        assertFailure(result);
        expect(result.error.message).toContain("different configuration");
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

    it("maps an AWS ValidationException to a 400, not an outage", async () => {
      const validationError = new Error("attribute value failed regex");
      validationError.name = "ValidationException";
      iotMock.on(CreateThingCommand).rejects(validationError);

      const result = await service.createThing(input);

      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_CREATE_THING_FAILED);
    });

    it("maps the modeled InvalidRequestException to a 400 as well", async () => {
      iotMock.on(CreateThingCommand).rejects(
        new InvalidRequestException({
          message: "Invalid thing name",
          $metadata: {},
        }),
      );

      const result = await service.createThing(input);

      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_CREATE_THING_FAILED);
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

    it("maps an SDK error to a detach-principal failure", async () => {
      iotMock.on(DetachThingPrincipalCommand).rejects(new Error("nope"));

      const result = await service.detachThingPrincipal("thing-1", "arn:cert");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_ATTACH_PRINCIPAL_FAILED);
    });
  });

  describe("listThingPrincipals", () => {
    it("collects principals across pages", async () => {
      iotMock
        .on(ListThingPrincipalsCommand)
        .resolvesOnce({ principals: ["arn:cert-1"], nextToken: "next" })
        .resolvesOnce({ principals: ["eu-central-1:identity-1"] });

      const result = await service.listThingPrincipals("thing-1");

      assertSuccess(result);
      expect(result.value).toEqual(["arn:cert-1", "eu-central-1:identity-1"]);
    });

    it("maps an SDK error to a list-principals failure", async () => {
      iotMock.on(ListThingPrincipalsCommand).rejects(new Error("nope"));

      const result = await service.listThingPrincipals("thing-1");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_LIST_PRINCIPALS_FAILED);
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

  describe("describeDataEndpoint", () => {
    const ENDPOINT = "abc123-ats.iot.eu-central-1.amazonaws.com";

    // The cache lives on the instance, so these tests use fresh instances
    // instead of the module singleton.
    const freshService = () => new AwsIotService(awsConfig);

    it("resolves the ATS data endpoint", async () => {
      iotMock.on(DescribeEndpointCommand).resolves({ endpointAddress: ENDPOINT });

      const result = await freshService().describeDataEndpoint();

      assertSuccess(result);
      expect(result.value).toBe(ENDPOINT);
      expect(iotMock.commandCalls(DescribeEndpointCommand)[0].args[0].input).toEqual({
        endpointType: "iot:Data-ATS",
      });
    });

    it("caches a resolved endpoint for the instance lifetime", async () => {
      iotMock.on(DescribeEndpointCommand).resolves({ endpointAddress: ENDPOINT });
      const cached = freshService();

      const first = await cached.describeDataEndpoint();
      const second = await cached.describeDataEndpoint();

      assertSuccess(first);
      assertSuccess(second);
      expect(second.value).toBe(ENDPOINT);
      expect(iotMock.commandCalls(DescribeEndpointCommand)).toHaveLength(1);
    });

    it("does not cache a failure", async () => {
      iotMock
        .on(DescribeEndpointCommand)
        .rejectsOnce(new Error("throttled"))
        .resolves({ endpointAddress: ENDPOINT });
      const cached = freshService();

      const first = await cached.describeDataEndpoint();
      assertFailure(first);
      expect(first.error.code).toBe(ErrorCodes.AWS_IOT_DESCRIBE_ENDPOINT_FAILED);

      const second = await cached.describeDataEndpoint();
      assertSuccess(second);
      expect(second.value).toBe(ENDPOINT);
      expect(iotMock.commandCalls(DescribeEndpointCommand)).toHaveLength(2);
    });

    it("fails when AWS returns no endpoint address", async () => {
      iotMock.on(DescribeEndpointCommand).resolves({});

      const result = await freshService().describeDataEndpoint();

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_DESCRIBE_ENDPOINT_FAILED);
    });
  });

  describe("probeDataEndpoint", () => {
    it("asks AWS every time, even after the endpoint is cached", async () => {
      iotMock
        .on(DescribeEndpointCommand)
        .resolves({ endpointAddress: "abc123-ats.iot.amazonaws.com" });
      const probed = new AwsIotService(awsConfig);

      await probed.describeDataEndpoint();
      const first = await probed.probeDataEndpoint();
      const second = await probed.probeDataEndpoint();

      assertSuccess(first);
      assertSuccess(second);
      expect(iotMock.commandCalls(DescribeEndpointCommand)).toHaveLength(3);
    });

    it("reports a failure under the endpoint error code", async () => {
      iotMock.on(DescribeEndpointCommand).rejects(new Error("throttled"));

      const result = await new AwsIotService(awsConfig).probeDataEndpoint();

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_DESCRIBE_ENDPOINT_FAILED);
    });
  });

  describe("searchThingsConnectivity", () => {
    it("maps indexed things to connectivity with an ISO last-seen", async () => {
      iotMock.on(SearchIndexCommand).resolves({
        things: [
          { thingName: "AMBYTE_A", connectivity: { connected: true, timestamp: 1755079200000 } },
          { thingName: "AMBYTE_B", connectivity: { connected: false, timestamp: 0 } },
        ],
      });

      const result = await service.searchThingsConnectivity(["AMBYTE_A", "AMBYTE_B"]);

      assertSuccess(result);
      expect(result.value.get("AMBYTE_A")).toEqual({
        thingName: "AMBYTE_A",
        connected: true,
        lastSeenAt: new Date(1755079200000).toISOString(),
      });
      // A zero timestamp means the index never recorded a state change.
      expect(result.value.get("AMBYTE_B")).toEqual({
        thingName: "AMBYTE_B",
        connected: false,
        lastSeenAt: null,
      });
    });

    it("omits things absent from the index response", async () => {
      iotMock.on(SearchIndexCommand).resolves({ things: [] });

      const result = await service.searchThingsConnectivity(["AMBYTE_MISSING"]);

      assertSuccess(result);
      expect(result.value.size).toBe(0);
    });

    it("follows nextToken pagination within a chunk", async () => {
      iotMock
        .on(SearchIndexCommand)
        .resolvesOnce({
          things: [{ thingName: "AMBYTE_A", connectivity: { connected: true, timestamp: 1 } }],
          nextToken: "page-2",
        })
        .resolvesOnce({
          things: [{ thingName: "AMBYTE_B", connectivity: { connected: true, timestamp: 2 } }],
        });

      const result = await service.searchThingsConnectivity(["AMBYTE_A", "AMBYTE_B"]);

      assertSuccess(result);
      expect(result.value.size).toBe(2);
      expect(iotMock.commandCalls(SearchIndexCommand)).toHaveLength(2);
    });

    it("chunks large fleets into multiple queries", async () => {
      const thingNames = Array.from({ length: 120 }, (_, i) => `AMBYTE_${String(i)}`);
      iotMock.on(SearchIndexCommand).resolves({ things: [] });

      const result = await service.searchThingsConnectivity(thingNames);

      assertSuccess(result);
      const calls = iotMock.commandCalls(SearchIndexCommand);
      expect(calls.length).toBeGreaterThanOrEqual(3);
      for (const call of calls) {
        const query = call.args[0].input.queryString ?? "";
        expect(query.length).toBeLessThanOrEqual(1000);
      }
    });

    it("maps an AWS failure to the search-index error code", async () => {
      iotMock.on(SearchIndexCommand).rejects(new Error("index not ready"));

      const result = await service.searchThingsConnectivity(["AMBYTE_A"]);

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_SEARCH_INDEX_FAILED);
    });
  });
});
