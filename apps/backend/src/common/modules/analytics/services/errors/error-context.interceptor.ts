import { Injectable } from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";

import { ErrorReporterService } from "./error-reporter.service";

/**
 * Runs each request as its signed-in user and request id, the way posthog-node's own
 * `PostHogInterceptor` does with PostHog's tracing headers, so an error reported anywhere inside
 * it, oRPC's included, counts against that user and leads to the request's log lines. Global
 * interceptors run after the auth guard, so the user is known here.
 */
@Injectable()
export class ErrorContextInterceptor implements NestInterceptor {
  constructor(private readonly reporter: ErrorReporterService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Subscribing inside the context is what runs the handler inside it.
    return new Observable((subscriber) =>
      this.reporter.withRequest(request, () => next.handle().subscribe(subscriber)),
    );
  }
}
