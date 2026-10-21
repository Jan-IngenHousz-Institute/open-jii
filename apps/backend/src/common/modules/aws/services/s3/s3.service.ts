import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";

import { GUEST_UPLOAD_MAX_BYTES } from "@repo/api/shared/guest";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { failure } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { IotUploadUrl, GuestUploadOptions } from "./s3.types";

const PRESIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes

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
  protected createSignedUrl(command: PutObjectCommand): Promise<string> {
    return getSignedUrl(
      command.input.ContentLength !== undefined ? this.guestS3Client : this.s3Client,
      command,
      {
        expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
        ...(command.input.ContentLength !== undefined
          ? { signableHeaders: new Set(["content-type", "content-length"]) }
          : {}),
      },
    );
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
