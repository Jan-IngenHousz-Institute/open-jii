import { Catch, HttpException } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import type { Request } from "express";

import { ErrorReporterService } from "./error-reporter.service";

/**
 * Reports server errors that reach Nest, then responds as Nest would. These are the errors the
 * oRPC rethrow plugin hands over, and those from guards and the routes outside oRPC.
 */
@Catch()
export class ErrorReportingFilter extends BaseExceptionFilter {
  constructor(
    adapterHost: HttpAdapterHost,
    private readonly reporter: ErrorReporterService,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === "http" && this.reporter.isServerError(exception)) {
      const request = host.switchToHttp().getRequest<Request>();
      // A filter runs after the request's context has closed, so the user is passed on.
      this.reporter.report(
        exception,
        {
          http_method: request.method,
          route: this.routeOf(request),
          status: exception instanceof HttpException ? exception.getStatus() : 500,
          request_id: this.reporter.requestIdOf(request),
        },
        this.reporter.userIdOf(request),
      );
    }
    super.catch(exception, host);
  }

  // The matched route pattern when Express has one, so ids in the path do not split an issue.
  private routeOf(request: Request): string {
    const route: unknown = request.route;
    return typeof route === "object" &&
      route !== null &&
      "path" in route &&
      typeof route.path === "string"
      ? route.path
      : request.path;
  }
}
