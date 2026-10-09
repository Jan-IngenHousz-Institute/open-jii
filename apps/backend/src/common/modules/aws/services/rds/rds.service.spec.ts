import { DescribeDBClustersCommand, RDSClient } from "@aws-sdk/client-rds";
import { Test } from "@nestjs/testing";
import { mockClient } from "aws-sdk-client-mock";

import { ErrorCodes } from "../../../../utils/error-codes";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import { AwsRdsService } from "./rds.service";

const rdsMock = mockClient(RDSClient);

describe("AwsRdsService", () => {
  let service: AwsRdsService;

  beforeEach(async () => {
    rdsMock.reset();
    const module = await Test.createTestingModule({
      providers: [
        AwsRdsService,
        { provide: AwsConfigService, useValue: { region: "eu-central-1" } },
      ],
    }).compile();
    service = module.get(AwsRdsService);
  });

  it("returns the cluster's status", async () => {
    rdsMock.on(DescribeDBClustersCommand).resolves({ DBClusters: [{ Status: "available" }] });

    const result = await service.clusterStatus("open-jii-dev-db-cluster");

    assertSuccess(result);
    expect(result.value).toBe("available");
    expect(rdsMock.commandCalls(DescribeDBClustersCommand)[0].args[0].input).toEqual({
      DBClusterIdentifier: "open-jii-dev-db-cluster",
    });
  });

  it("fails when RDS answers without a status", async () => {
    rdsMock.on(DescribeDBClustersCommand).resolves({ DBClusters: [] });

    const result = await service.clusterStatus("open-jii-dev-db-cluster");

    assertFailure(result);
    expect(result.error.code).toBe(ErrorCodes.AWS_RDS_DESCRIBE_FAILED);
  });

  it("reports a failed request under its own code", async () => {
    rdsMock.on(DescribeDBClustersCommand).rejects(new Error("DBClusterNotFoundFault"));

    const result = await service.clusterStatus("open-jii-dev-db-cluster");

    assertFailure(result);
    expect(result.error.code).toBe(ErrorCodes.AWS_RDS_DESCRIBE_FAILED);
    expect(result.error.message).toContain("DBClusterNotFoundFault");
  });
});
