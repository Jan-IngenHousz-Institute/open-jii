import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import type { Request } from "express";

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers["x-internal-api-key"] as string | undefined;
    const expected = this.configService.get<string>("aws.internalApiKey");

    if (!expected) {
      this.logger.error({ msg: "INTERNAL_API_KEY not configured" });
      throw new UnauthorizedException("Unauthorized");
    }

    if (!key) {
      this.logger.warn({ msg: "Missing internal API key header" });
      throw new UnauthorizedException("Unauthorized");
    }

    // Constant-time comparison to prevent timing attacks
    const keyBuf = Buffer.from(key);
    const expectedBuf = Buffer.from(expected);
    const valid =
      keyBuf.length === expectedBuf.length && crypto.timingSafeEqual(keyBuf, expectedBuf);

    if (!valid) {
      this.logger.warn({ msg: "Invalid internal API key" });
      throw new UnauthorizedException("Unauthorized");
    }

    return true;
  }
}
