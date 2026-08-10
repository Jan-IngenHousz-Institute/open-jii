import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { z } from "zod";

import type { ResourceAction } from "@repo/auth/access";
import type { ResourceType } from "@repo/database";

import { AuthorizationService } from "./authorization.service";

/** Reflector metadata key holding the `@CanAccess` requirement for a route. */
export const CAN_ACCESS_KEY = "can-access";

export interface CanAccessMetadata {
  resource: ResourceType;
  action: ResourceAction;
  /**
   * Where the resource id is carried. Defaults to the route params; use `"body"`
   * for routes that identify the resource in the payload rather than the path.
   */
  source?: "params" | "body";
  /** Param or body field holding the resource id. Defaults to "id". */
  param?: string;
}

/** Request shape after the global Better Auth `AuthGuard` has populated it. */
interface AuthenticatedRequest extends Request {
  session?: { user?: { id?: string } } | null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Declarative per-resource authorization. Reads the `@CanAccess` requirement
 * from route metadata, resolves the target resource id from the route params (or
 * the body, for routes that carry it there), and delegates the decision to
 * `AuthorizationService.can()`. Runs after the global `AuthGuard` (which sets
 * `request.session`), so the caller is known.
 *
 * Denials throw Nest HTTP exceptions (403 forbidden, 404 not-found) — the same
 * mechanism the global auth guard uses for 401 — rather than oRPC errors, which
 * are only formatted inside the handler pipeline.
 */
@Injectable()
export class CanAccessGuard implements CanActivate {
  private readonly logger = new Logger(CanAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<CanAccessMetadata | undefined>(CAN_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // No requirement declared on this route → nothing to enforce here.
    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.session?.user?.id;
    if (!userId) {
      // Should be unreachable behind the global AuthGuard, but fail closed.
      throw new ForbiddenException("Unauthorized");
    }

    this.assertPathParamsNotContradicted(request);

    const param = meta.param ?? "id";
    const source = meta.source ?? "params";
    const container = source === "body" ? asRecord(request.body) : request.params;
    const rawId: unknown = container?.[param];
    const candidateId: unknown = Array.isArray(rawId) ? (rawId as unknown[])[0] : rawId;
    if (candidateId === undefined || candidateId === null || candidateId === "") {
      // A body-sourced id is client-supplied, so its absence is a bad request; a
      // missing route param means the route and the decorator disagree, which is
      // our bug — log it and fail closed rather than blaming the caller.
      if (source === "body") {
        throw new BadRequestException(`A valid ${param} is required`);
      }
      this.logger.error({
        msg: "CanAccess: route is missing the resource-id param",
        operation: "canAccess",
        param,
        path: request.path,
      });
      throw new ForbiddenException("Forbidden");
    }
    const parsed = z.string().uuid().safeParse(candidateId);
    if (!parsed.success) {
      throw new BadRequestException(`Invalid ${param}`);
    }
    const resourceId = parsed.data;

    const decision = await this.authz.can(userId, {
      resourceType: meta.resource,
      resourceId,
      action: meta.action,
    });

    if (!decision.allow) {
      this.logger.warn({
        msg: "Access denied",
        operation: "canAccess",
        resourceType: meta.resource,
        resourceId,
        action: meta.action,
        userId,
        reason: decision.reason,
      });
      // Hide existence of resources the caller can't see.
      if (decision.reason === "not-found") {
        throw new NotFoundException(`${meta.resource} with ID ${resourceId} not found`);
      }
      throw new ForbiddenException(`You cannot ${meta.action} this ${meta.resource}`);
    }

    return true;
  }

  /**
   * Refuse a request whose payload contradicts its own URL.
   *
   * The handler does not receive the route params this guard authorized; it
   * receives them merged with the client-supplied payload, built as
   * `{ ...routeParams, ...payload }`. The payload is spread last, so a key that
   * repeats a path param name replaces the value that was authorized here — a
   * caller could pass a resource it may read in the path and the one it may not in
   * the payload, and be checked against the first while being served the second.
   *
   * Restating a path param verbatim is allowed; anything else is not. The
   * comparison is strict, so a value that differs in letter case, arrives as a
   * number, or arrives as an array (which is what a repeated query key produces)
   * counts as a contradiction — the generated request builder strips path params
   * out of the payload before sending, so a payload value under a path param name
   * only ever reaches here from a hand-built request.
   *
   * Only the payload the request decoder actually merges is inspected — the query
   * string on `GET`, the parsed body on every other method — so a stray query param
   * on a write, which the decoder ignores and which therefore cannot reach the
   * handler, does not produce a spurious rejection.
   */
  private assertPathParamsNotContradicted(request: Request): void {
    const payload = request.method === "GET" ? asRecord(request.query) : asRecord(request.body);
    if (!payload) {
      return;
    }

    for (const [name, pathValue] of Object.entries(request.params)) {
      if (!(name in payload) || payload[name] === pathValue) {
        continue;
      }
      this.logger.warn({
        msg: "Rejected a request whose payload contradicts a path parameter",
        operation: "canAccess",
        param: name,
        path: request.path,
      });
      throw new BadRequestException(`${name} in the request does not match the URL path`);
    }
  }
}
