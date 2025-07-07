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

import { stableStringify } from "../utils/stable-json";

@Injectable()
export class HmacGuard implements CanActivate {
  private readonly logger = new Logger(HmacGuard.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Look up API key from the config using the provided ID
   * @param keyId - The API key ID from request headers
   * @returns The actual API key or null if not found
   */
  private getApiKeyById(keyId: string): string | null {
    try {
      const apiKeys = this.configService.getOrThrow<Record<string, string>>(
        "databricks.webhookApiKeys",
      );

      const apiKey = apiKeys[keyId];

      if (!apiKey) {
        this.logger.warn(`API key not found for ID: ${keyId}`);
        return null;
      }

      return apiKey;
    } catch (error) {
      this.logger.error(`Failed to get API key for ID: ${keyId}`, error);
      return null;
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyId = request.headers["x-api-key-id"] as string;
    const signature = request.headers["x-databricks-signature"] as string;
    const timestamp = request.headers["x-databricks-timestamp"] as string;

    try {
      // Validate API key ID and look up the actual API key
      if (!apiKeyId) {
        this.logger.warn("Missing API key ID");
        throw new UnauthorizedException("Missing API key ID");
      }

      // Get the actual API key using the ID
      const apiKey = this.getApiKeyById(apiKeyId);
      if (!apiKey) {
        this.logger.warn("Invalid API key ID provided");
        throw new UnauthorizedException("Invalid API key ID");
      }

      // Get webhook secret from config
      const webhookSecret = this.configService.getOrThrow<string>("databricks.webhookSecret");

      // Validate HMAC signature
      if (!signature || !timestamp) {
        this.logger.warn("Missing signature or timestamp headers");
        throw new UnauthorizedException("Missing signature or timestamp");
      }

      // Validate timestamp to prevent replay attacks
      // Timestamp should be within 5 minutes
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampValue = parseInt(timestamp, 10);
      const fiveMinutesInSeconds = 5 * 60;

      if (isNaN(timestampValue) || Math.abs(currentTime - timestampValue) > fiveMinutesInSeconds) {
        this.logger.warn(`Invalid timestamp: ${timestamp}. Current time: ${currentTime}`);
        throw new UnauthorizedException("Request timestamp is too old or invalid");
      }

      // Get the raw body directly from the request
      let rawBody: string;
      try {
        if (request.body) {
          // If body-parser already consumed the stream, use the parsed body
          // and re-stringify it in a stable way
          rawBody = stableStringify(request.body);
        } else {
          // If we can't get the raw body, use an empty string
          // This should not happen in normal operation
          rawBody = "";
        }
      } catch (error) {
        this.logger.error("Failed to get raw request body", error);
        throw new InternalServerErrorException("Failed to process request body");
      }

      // Create the payload string with timestamp prefix
      const payload = `${timestamp}:${rawBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      // Use timingSafeEqual to prevent timing attacks
      try {
        // Convert hex strings to Buffer for comparison
        const signatureBuffer = Buffer.from(signature, "hex");
        const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");

        if (!crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
          this.logger.warn("Invalid signature provided");
          throw new UnauthorizedException("Invalid signature");
        }
      } catch (error) {
        // This can happen if the signatures have different lengths or are not valid hex
        this.logger.warn("Signature comparison failed", error);
        throw new UnauthorizedException("Invalid signature format");
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error("Webhook authentication failed", error);
      throw new InternalServerErrorException("Webhook authentication failed");
    }
  }
}
