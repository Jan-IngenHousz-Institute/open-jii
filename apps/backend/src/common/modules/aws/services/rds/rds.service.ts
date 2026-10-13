import { DescribeDBClustersCommand, RDSClient } from "@aws-sdk/client-rds";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";

@Injectable()
export class AwsRdsService {
  private readonly rdsClient: RDSClient;

  constructor(private readonly awsConfig: AwsConfigService) {
    this.rdsClient = new RDSClient({ region: this.awsConfig.region });
  }

  // The control plane answers without touching the cluster, so asking never wakes it.
  async clusterStatus(clusterIdentifier: string): Promise<Result<string>> {
    return tryCatch(
      async () => {
        const response = await this.rdsClient.send(
          new DescribeDBClustersCommand({ DBClusterIdentifier: clusterIdentifier }),
        );
        const status = response.DBClusters?.at(0)?.Status;

        if (!status) {
          throw AppError.internal(
            `RDS returned no status for ${clusterIdentifier}`,
            ErrorCodes.AWS_RDS_DESCRIBE_FAILED,
          );
        }

        return status;
      },
      (error) => {
        if (error instanceof AppError) {
          return error;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        return AppError.internal(
          `RDS DescribeDBClusters failed: ${message}`,
          ErrorCodes.AWS_RDS_DESCRIBE_FAILED,
        );
      },
    );
  }
}
