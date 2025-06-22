import { Injectable, Inject } from "@nestjs/common";

import { ExperimentFilter, ExperimentStatus } from "@repo/api";
import { eq, or, and, experiments, experimentMembers } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import {
  Result,
  tryCatch,
  AppError,
  defaultRepositoryErrorMapper,
} from "../../../common/utils/fp-utils";
import { ExperimentMemberRole } from "../models/experiment-members.model";
import {
  CreateExperimentDto,
  UpdateExperimentDto,
  ExperimentDto,
} from "../models/experiment.model";

@Injectable()
export class ExperimentRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    createExperimentDto: CreateExperimentDto,
    userId: string,
  ): Promise<Result<ExperimentDto[]>> {
    return tryCatch(() =>
      this.database
        .insert(experiments)
        .values({
          ...createExperimentDto,
          createdBy: userId,
        })
        .returning(),
    );
  }

  async findAll(
    userId: string,
    filter?: ExperimentFilter,
    status?: ExperimentStatus,
  ): Promise<Result<ExperimentDto[]>> {
    // Common experiment fields to select
    // Todo: type this thing properly
    const experimentFields = {
      id: experiments.id,
      name: experiments.name,
      description: experiments.description,
      status: experiments.status,
      visibility: experiments.visibility,
      embargoIntervalDays: experiments.embargoIntervalDays,
      createdAt: experiments.createdAt,
      createdBy: experiments.createdBy,
      updatedAt: experiments.updatedAt,
    };

    return tryCatch(() => {
      // Start with a base query builder
      const query = this.database.select(experimentFields).from(experiments);

      // Apply filter and status conditions without nested conditionals
      if (filter === "my") {
        if (status) {
          return query.where(
            and(
              eq(experiments.createdBy, userId),
              eq(experiments.status, status),
            ),
          );
        }
        return query.where(eq(experiments.createdBy, userId));
      }

      if (filter === "member") {
        const joinedQuery = query.innerJoin(
          experimentMembers,
          eq(experiments.id, experimentMembers.experimentId),
        );

        if (status) {
          return joinedQuery.where(
            and(
              eq(experimentMembers.userId, userId),
              eq(experiments.status, status),
            ),
          );
        }
        return joinedQuery.where(eq(experimentMembers.userId, userId));
      }

      if (filter === "related") {
        const joinedQuery = query.leftJoin(
          experimentMembers,
          eq(experiments.id, experimentMembers.experimentId),
        );

        if (status) {
          return joinedQuery.where(
            and(
              or(
                eq(experiments.createdBy, userId),
                eq(experimentMembers.userId, userId),
              ),
              eq(experiments.status, status),
            ),
          );
        }
        return joinedQuery.where(
          or(
            eq(experiments.createdBy, userId),
            eq(experimentMembers.userId, userId),
          ),
        );
      }

      // Default cases (no filter or unrecognized filter)
      if (status) {
        return query.where(eq(experiments.status, status));
      }

      return query;
    });
  }

  async findOne(id: string): Promise<Result<ExperimentDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(experiments)
        .where(eq(experiments.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0];
    });
  }

  async findByName(name: string): Promise<Result<ExperimentDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(experiments)
        .where(eq(experiments.name, name))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0];
    });
  }

  async update(
    id: string,
    updateExperimentDto: UpdateExperimentDto,
  ): Promise<Result<ExperimentDto[]>> {
    return tryCatch(() =>
      this.database
        .update(experiments)
        .set(updateExperimentDto)
        .where(eq(experiments.id, id))
        .returning(),
    );
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      // First delete experiment members to maintain referential integrity
      await this.database
        .delete(experimentMembers)
        .where(eq(experimentMembers.experimentId, id));

      // Then delete the experiment
      await this.database.delete(experiments).where(eq(experiments.id, id));
    });
  }

  async checkAccess(
    experimentId: string,
    userId: string,
  ): Promise<
    Result<{
      experiment: ExperimentDto | null;
      hasAccess: boolean;
      isAdmin: boolean;
    }>
  > {
    return tryCatch(async () => {
      const experimentFields = {
        id: experiments.id,
        name: experiments.name,
        description: experiments.description,
        status: experiments.status,
        visibility: experiments.visibility,
        embargoIntervalDays: experiments.embargoIntervalDays,
        createdAt: experiments.createdAt,
        createdBy: experiments.createdBy,
        updatedAt: experiments.updatedAt,
      };

      const result = await this.database
        .select({
          experiment: experimentFields,
          memberRole: experimentMembers.role,
        })
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

      if (result.length === 0) {
        return { experiment: null, hasAccess: false, isAdmin: false };
      }

      const { experiment, memberRole } = result[0];
      const isMember = memberRole !== null;
      const isAdmin = memberRole === "admin";

      return { experiment, hasAccess: isMember, isAdmin };
    });
  }

  async createWithMembers(
    createExperimentDto: CreateExperimentDto,
    userId: string,
    members?: { userId: string; role?: ExperimentMemberRole }[],
  ): Promise<Result<ExperimentDto>> {
    return tryCatch(
      () => {
        return this.database.transaction(async (tx) => {
          // Create the experiment
          const [experiment] = await tx
            .insert(experiments)
            .values({
              ...createExperimentDto,
              createdBy: userId,
            })
            .returning();

          // Filter out any member with the same userId as the admin
          const filteredMembers = (
            Array.isArray(members) ? members : []
          ).filter((member) => member.userId !== userId);

          // Add the user as an admin member + the rest of the members if provided
          const allMembers = [
            { userId, role: "admin" as const },
            ...filteredMembers,
          ];

          // Insert all members in a single operation (we always have at least the admin)
          await tx.insert(experimentMembers).values(
            allMembers.map((member) => ({
              experimentId: experiment.id,
              userId: member.userId,
              role: member.role,
            })),
          );

          return experiment;
        });
      },
      (error: unknown) => {
        // Enhanced error mapping for createWithMembers
        if (error instanceof Error) {
          const message = error.message.toLowerCase();

          // Handle specific database constraint violations with better messages
          if (message.includes("experiments_name_unique")) {
            return AppError.badRequest(
              `An experiment with the name "${createExperimentDto.name}" already exists`,
              "REPOSITORY_DUPLICATE",
              error,
            );
          }

          if (message.includes("name_not_empty")) {
            return AppError.badRequest(
              "Experiment name cannot be empty or contain only whitespace",
              "REPOSITORY_ERROR",
              error,
            );
          }

          if (
            message.includes("foreign key constraint") &&
            message.includes("users")
          ) {
            return AppError.badRequest(
              "One or more specified user IDs do not exist",
              "REPOSITORY_ERROR",
              error,
            );
          }

          if (
            message.includes("foreign key constraint") &&
            message.includes("created_by")
          ) {
            return AppError.badRequest(
              "The specified creator user ID does not exist",
              "REPOSITORY_ERROR",
              error,
            );
          }

          if (message.includes("null value in column")) {
            const nullColumnRegex = /null value in column "([^"]+)"/;
            const columnMatch = nullColumnRegex.exec(message);
            const column = columnMatch ? columnMatch[1] : "required field";
            return AppError.badRequest(
              `${column} is required and cannot be null`,
              "REPOSITORY_ERROR",
              error,
            );
          }

          if (message.includes("invalid input syntax for type uuid")) {
            return AppError.badRequest(
              "Invalid user ID format provided",
              "REPOSITORY_ERROR",
              error,
            );
          }
        }

        // Fall back to default error mapping
        return defaultRepositoryErrorMapper(error);
      },
    );
  }
}
