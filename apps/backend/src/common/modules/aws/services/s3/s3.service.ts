import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { IotUploadUrl } from "./s3.types";

const PRESIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes

@Injectable()
export class AwsS3Service {
  private readonly s3Client: S3Client;

  constructor(private readonly awsConfig: AwsConfigService) {
    this.s3Client = new S3Client({ region: this.awsConfig.region });
  }

  // Separated from getIotUploadUrl so tests can spy on this method (ESM exports are not configurable).
  protected createSignedUrl(command: PutObjectCommand): Promise<string> {
    return getSignedUrl(this.s3Client, command, { expiresIn: PRESIGNED_URL_EXPIRY_SECONDS });
  }

  async getIotUploadUrl(experimentId: string): Promise<Result<IotUploadUrl>> {
    return tryCatch(
      async () => {
        const key = `large-iot/${experimentId}/${crypto.randomUUID()}.json`;
        const command = new PutObjectCommand({
          Bucket: this.awsConfig.s3Config.largeIotBucketName,
          Key: key,
          ContentType: "application/json",
        });

        const uploadUrl = await this.createSignedUrl(command);

        return {
          uploadUrl,
          key,
          expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY_SECONDS * 1000),
        };
      },
      (error) => {
        if (error instanceof AppError) {
          return error;
        }
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return AppError.internal(errorMessage, ErrorCodes.AWS_S3_PRESIGN_FAILED);
      },
    );
  }
}
