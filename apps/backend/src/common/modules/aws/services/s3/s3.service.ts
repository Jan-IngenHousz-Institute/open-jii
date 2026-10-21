import { S3Client, GetObjectCommand, NoSuchKey, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";

import { GUEST_UPLOAD_MAX_BYTES } from "@repo/api/shared/guest";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { failure } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { IotUploadUrl, SignedDownloadUrl, GuestUploadOptions } from "./s3.types";

const PRESIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes

// Long enough for a download manager to start every part of a large export in turn.
const EXPORT_DOWNLOAD_EXPIRY_SECONDS = 3600;

@Injectable()
export class AwsS3Service {
  private readonly s3Client: S3Client;
  private readonly guestS3Client: S3Client;

  constructor(private readonly awsConfig: AwsConfigService) {
    this.s3Client = new S3Client({ region: this.awsConfig.region });
    // The payload arrives later. Do not sign a checksum of an empty body.
    this.guestS3Client = new S3Client({
      region: this.awsConfig.region,
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  // Separated from getIotUploadUrl so tests can spy on this method (ESM exports are not configurable).
  protected createSignedUrl(
    command: PutObjectCommand | GetObjectCommand,
    guest?: GuestUploadOptions,
    expiresIn = PRESIGNED_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    return getSignedUrl(guest ? this.guestS3Client : this.s3Client, command, {
      expiresIn,
      ...(guest ? { signableHeaders: new Set(["content-type", "content-length"]) } : {}),
    });
  }

  /** A signed URL stops working when the credentials that signed it expire, whatever it says. */
  protected async signingCredentialsExpiry(): Promise<Date | undefined> {
    const credentials = await this.s3Client.config.credentials();
    return credentials.expiration;
  }

  async getIotUploadUrl(
    experimentId: string,
    guest?: GuestUploadOptions,
  ): Promise<Result<IotUploadUrl>> {
    if (
      guest &&
      (!Number.isInteger(guest.guestContentLength) ||
        guest.guestContentLength <= 0 ||
        guest.guestContentLength > GUEST_UPLOAD_MAX_BYTES)
    ) {
      return failure(
        AppError.badRequest("Guest uploads must be at most 1 MiB", "GUEST_UPLOAD_SIZE_INVALID"),
      );
    }
    return tryCatch(
      async () => {
        const prefix = guest
          ? `large-iot/${experimentId.toLowerCase()}/guest`
          : `large-iot/${experimentId}`;
        const key = `${prefix}/${crypto.randomUUID()}.json`;
        const command = new PutObjectCommand({
          Bucket: this.awsConfig.s3Config.largeIotBucketName,
          Key: key,
          ContentType: "application/json",
          ...(guest ? { ContentLength: guest.guestContentLength } : {}),
        });

        const uploadUrl = await this.createSignedUrl(command, guest);

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

        const url = await this.createSignedUrl(command, undefined, EXPORT_DOWNLOAD_EXPIRY_SECONDS);
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
