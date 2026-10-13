import {
  CloudWatchClient,
  GetMetricDataCommand,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { Test } from "@nestjs/testing";
import { mockClient } from "aws-sdk-client-mock";

import { ErrorCodes } from "../../../../utils/error-codes";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import { AwsCloudWatchService } from "./cloudwatch.service";

const cloudWatchMock = mockClient(CloudWatchClient);

describe("AwsCloudWatchService", () => {
  let service: AwsCloudWatchService;

  beforeEach(async () => {
    cloudWatchMock.reset();
    const module = await Test.createTestingModule({
      providers: [
        AwsCloudWatchService,
        { provide: AwsConfigService, useValue: { region: "eu-central-1" } },
      ],
    }).compile();
    service = module.get(AwsCloudWatchService);
  });

  describe("latestDatabaseCapacity", () => {
    it("returns the newest capacity reading for the cluster", async () => {
      cloudWatchMock
        .on(GetMetricDataCommand)
        .resolves({ MetricDataResults: [{ Id: "capacity", Values: [0, 0.5] }] });

      const result = await service.latestDatabaseCapacity("open-jii-dev-db-cluster");

      assertSuccess(result);
      expect(result.value).toBe(0);
      const input = cloudWatchMock.commandCalls(GetMetricDataCommand)[0].args[0].input;
      expect(input.ScanBy).toBe("TimestampDescending");
      expect(input.MetricDataQueries?.[0]?.MetricStat?.Metric).toEqual({
        Namespace: "AWS/RDS",
        MetricName: "ServerlessDatabaseCapacity",
        Dimensions: [{ Name: "DBClusterIdentifier", Value: "open-jii-dev-db-cluster" }],
      });
    });

    it("returns null when the window holds no reading", async () => {
      cloudWatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [{ Values: [] }] });

      const result = await service.latestDatabaseCapacity("open-jii-dev-db-cluster");

      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("reports a failed read under its own code", async () => {
      cloudWatchMock.on(GetMetricDataCommand).rejects(new Error("AccessDenied"));

      const result = await service.latestDatabaseCapacity("open-jii-dev-db-cluster");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_CLOUDWATCH_READ_FAILED);
    });
  });

  describe("publish", () => {
    it("sends each point with its unit and dimensions", async () => {
      cloudWatchMock.on(PutMetricDataCommand).resolves({});

      const result = await service.publish("OpenJII/Backend", [
        {
          name: "DependencyUp",
          value: 1,
          unit: "Count",
          dimensions: { Environment: "dev", Dependency: "email" },
        },
      ]);

      assertSuccess(result);
      expect(cloudWatchMock.commandCalls(PutMetricDataCommand)[0].args[0].input).toEqual({
        Namespace: "OpenJII/Backend",
        MetricData: [
          {
            MetricName: "DependencyUp",
            Value: 1,
            Unit: "Count",
            Dimensions: [
              { Name: "Environment", Value: "dev" },
              { Name: "Dependency", Value: "email" },
            ],
          },
        ],
      });
    });

    it("reports a failed publish under its own code", async () => {
      cloudWatchMock.on(PutMetricDataCommand).rejects(new Error("AccessDenied"));

      const result = await service.publish("OpenJII/Backend", []);

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_CLOUDWATCH_PUBLISH_FAILED);
    });
  });
});
