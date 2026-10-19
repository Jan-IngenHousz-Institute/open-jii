import { S3Client, GetObjectCommand, NoSuchKey, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { IotUploadUrl, SignedDownloadUrl } from "./s3.types";

const PRESIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes

// Long enough for a download manager to start every part of a large export in turn.
const EXPORT_DOWNLOAD_EXPIRY_SECONDS = 3600;

@Injectable()
export class AwsS3Service {
  private readonly s3Client: S3Client;

  constructor(private readonly awsConfig: AwsConfigService) {
    this.s3Client = new S3Client({ region: this.awsConfig.region });
  }

  // Separated from the callers so tests can spy on this method (ESM exports are not configurable).
  protected createSignedUrl(
    command: PutObjectCommand | GetObjectCommand,
    expiresIn = PRESIGNED_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /** A signed URL stops working when the credentials that signed it expire, whatever it says. */
  protected async signingCredentialsExpiry(): Promise<Date | undefined> {
    const credentials = await this.s3Client.config.credentials();
    return credentials.expiration;
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
      (error) => this.toAppError(error, ErrorCodes.AWS_S3_PRESIGN_FAILED),
    );
  }

  /** A link that downloads one export file straight from the bucket under `fileName`. */
  async getExportDownloadUrl(key: string, fileName: string): Promise<Result<SignedDownloadUrl>> {
    return tryCatch(
      async () => {
        const command = new GetObjectCommand({
          Bucket: this.awsConfig.s3Config.dataExportsBucketName,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${fileName}"`,
        });

        const url = await this.createSignedUrl(command, EXPORT_DOWNLOAD_EXPIRY_SECONDS);
        const signedExpiry = Date.now() + EXPORT_DOWNLOAD_EXPIRY_SECONDS * 1000;
        const credentialsExpiry = (await this.signingCredentialsExpiry())?.getTime() ?? Infinity;

        return { url, expiresAt: new Date(Math.min(signedExpiry, credentialsExpiry)) };
      },
      (error) => this.toAppError(error, ErrorCodes.AWS_S3_PRESIGN_FAILED),
    );
  }

  /** The text of a small object in the export bucket, or null when it does not exist. */
  async readExportObject(key: string): Promise<Result<string | null>> {
    return tryCatch(
      async () => {
        try {
          const response = await this.s3Client.send(
            new GetObjectCommand({
              Bucket: this.awsConfig.s3Config.dataExportsBucketName,
              Key: key,
            }),
          );

          return (await response.Body?.transformToString("utf-8")) ?? null;
        } catch (error) {
          if (error instanceof NoSuchKey) {
            return null;
          }
          throw error;
        }
      },
      (error) => this.toAppError(error, ErrorCodes.AWS_S3_READ_FAILED),
    );
  }

  private toAppError(error: unknown, code: ErrorCodes): AppError {
    if (error instanceof AppError) {
      return error;
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return AppError.internal(errorMessage, code);
  }
}
