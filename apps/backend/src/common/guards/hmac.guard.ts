import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import type { Request } from "express";

import { ErrorCodes } from "../utils/error-codes";
import { stableStringify } from "../utils/stable-json";

// Logged once per rejection as `reason`. The alert on rejected pipeline calls selects on these
// values, so renaming one silently drops it from that alert.
export type HmacRejectionReason =
  | "missing-key-id"
  | "unknown-key"
  | "missing-signature"
  | "stale-timestamp"
  | "bad-signature";

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

@Injectable()
export class HmacGuard implements CanActivate {
  private readonly logger = new Logger(HmacGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyId = this.header(request, "x-api-key-id");
    const signature = this.header(request, "x-databricks-signature");
    const timestamp = this.header(request, "x-databricks-timestamp");

    try {
      if (!apiKeyId) {
        return this.reject("missing-key-id", "Missing API key ID");
      }

      const apiKeys = this.configService.getOrThrow<Record<string, string>>(
        "databricks.webhookApiKeys",
      );
      if (!apiKeys[apiKeyId]) {
        return this.reject("unknown-key", "Invalid API key ID provided", { keyId: apiKeyId });
      }

      const webhookSecret = this.configService.getOrThrow<string>("databricks.webhookSecret");

      if (!signature || !timestamp) {
        return this.reject("missing-signature", "Missing signature or timestamp headers");
      }

      // A timestamp outside the tolerance would let a captured request be replayed.
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampValue = parseInt(timestamp, 10);
      const timeDiff = Math.abs(currentTime - timestampValue);
      if (isNaN(timestampValue) || timeDiff > TIMESTAMP_TOLERANCE_SECONDS) {
        return this.reject("stale-timestamp", "Invalid timestamp", {
          timestamp,
          currentTime,
          timeDiff,
        });
      }

      // Body-parser has already consumed the stream, so the signed payload is the parsed body
      // re-serialised in a stable key order.
      const rawBody = request.body ? stableStringify(request.body) : "";
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(`${timestamp}:${rawBody}`)
        .digest("hex");

      const signatureBuffer = Buffer.from(signature, "hex");
      const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");
      const isSignatureValid =
        signatureBuffer.length === expectedSignatureBuffer.length &&
        crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer);
      if (!isSignatureValid) {
        return this.reject("bad-signature", "Invalid signature provided");
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error({
        msg: "HMAC verification failed",
        errorCode: ErrorCodes.HMAC_AUTHENTICATION_FAILED,
        operation: "hmacAuth",
        reason: "internal-error",
        error,
      });
      throw new InternalServerErrorException("HMAC verification failed");
    }
  }

  private reject(
    reason: HmacRejectionReason,
    msg: string,
    details: Record<string, unknown> = {},
  ): never {
    this.logger.warn({
      msg,
      errorCode: ErrorCodes.HMAC_AUTHENTICATION_FAILED,
      operation: "hmacAuth",
      reason,
      ...details,
    });
    throw new UnauthorizedException("Unauthorized");
  }

  private header(request: Request, name: string): string | undefined {
    const value = request.headers[name];
    return typeof value === "string" ? value : undefined;
  }
}
