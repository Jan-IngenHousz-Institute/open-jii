import {
  applyDecorators,
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { z } from "zod";

import { and, eq, experimentMembers, experiments } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

const CAN_CONTRIBUTE_TO_EXPERIMENT_KEY = "can-contribute-to-experiment";
const experimentIdSchema = z.string().uuid();

export interface CanContributeToExperimentMetadata {
  /** Where the experiment id is carried. Defaults to the route params. */
  source?: "params" | "body";
  /** Field containing the experiment id. Defaults to `id`. */
  param?: string;
}

interface AuthenticatedRequest extends Request {
  session?: { user?: { id?: string } } | null;
}

function asUnknownRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Enforces the experiment contributor capability. This is intentionally
 * separate from `@CanAccess`: public/org/grant read access does not imply that
 * a user may add or alter experiment data.
 */
@Injectable()
export class CanContributeToExperimentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject("DATABASE") private readonly db: DatabaseInstance,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<CanContributeToExperimentMetadata | undefined>(
      CAN_CONTRIBUTE_TO_EXPERIMENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.session?.user?.id;
    if (!userId) throw new ForbiddenException("Unauthorized");

    const source = meta.source ?? "params";
    const param = meta.param ?? "id";
    const container: Record<string, unknown> | undefined =
      source === "body" ? asUnknownRecord(request.body) : request.params;
    const rawId: unknown = container?.[param];
    const candidateId: unknown = Array.isArray(rawId) ? (rawId as unknown[])[0] : rawId;
    const parsedId = experimentIdSchema.safeParse(candidateId);
    if (!parsedId.success) {
      throw new BadRequestException("A valid experiment id is required");
    }
    const experimentId = parsedId.data;

    const rows = await this.db
      .select({ experimentId: experiments.id, memberId: experimentMembers.userId })
      .from(experiments)
      .leftJoin(
        experimentMembers,
        and(
          eq(experimentMembers.experimentId, experiments.id),
          eq(experimentMembers.userId, userId),
        ),
      )
      .where(eq(experiments.id, experimentId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Experiment with ID ${experimentId} not found`);
    }
    if (!rows[0].memberId) {
      throw new ForbiddenException("Only experiment members may contribute to this experiment");
    }

    return true;
  }
}

/** Declare that a route requires experiment membership, not merely read access. */
export function CanContributeToExperiment(meta: CanContributeToExperimentMetadata = {}) {
  return applyDecorators(
    SetMetadata(CAN_CONTRIBUTE_TO_EXPERIMENT_KEY, meta),
    UseGuards(CanContributeToExperimentGuard),
  );
}
