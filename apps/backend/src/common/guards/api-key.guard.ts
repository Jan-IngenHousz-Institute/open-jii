import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers["x-api-key"] as string;

    try {
      // Get API key from config
      const expectedApiKey = this.configService.getOrThrow<string>("databricks.webhookApiKey");

      if (!apiKey || apiKey !== expectedApiKey) {
        throw new UnauthorizedException("Unauthorized");
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException("API key validation failed");
    }
  }
}
