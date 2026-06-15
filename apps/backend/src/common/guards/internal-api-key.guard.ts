import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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

    if (!key || key !== expected) {
      this.logger.warn({ msg: "Invalid internal API key" });
      throw new UnauthorizedException("Unauthorized");
    }

    return true;
  }
}
