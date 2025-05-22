import { Injectable, Inject } from "@nestjs/common";

import { ExperimentFilter, ExperimentStatus } from "@repo/api";
import { eq, or, and, experiments, experimentMembers } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../utils/fp-utils";
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
  ): Promise<Result<Partial<ExperimentDto>[]>> {
    // Common experiment fields to select
    const experimentFields = {
      id: experiments.id,
      name: experiments.name,
      status: experiments.status,
      visibility: experiments.visibility,
      embargoIntervalDays: experiments.embargoIntervalDays,
      createdAt: experiments.createdAt,
      createdBy: experiments.createdBy,
    };

    return tryCatch(() => {
      // Start with a base query builder
      const query = this.database.select(experimentFields).from(experiments);
      
      // Build different queries based on combined filter and status
      if (filter && status) {
        // Both filter and status are provided
        switch (filter) {
          case "my":
            return query.where(
              and(
                eq(experiments.createdBy, userId),
                eq(experiments.status, status)
              )
            );

          case "member":
            return query
              .innerJoin(
                experimentMembers,
                eq(experiments.id, experimentMembers.experimentId),
              )
              .where(
                and(
                  eq(experimentMembers.userId, userId),
                  eq(experiments.status, status)
                )
              );

          case "related":
            return query
              .leftJoin(
                experimentMembers,
                eq(experiments.id, experimentMembers.experimentId),
              )
              .where(
                and(
                  or(
                    eq(experiments.createdBy, userId),
                    eq(experimentMembers.userId, userId),
                  ),
                  eq(experiments.status, status)
                )
              );
              
          default:
            return query.where(eq(experiments.status, status));
        }
      } else if (filter) {
        // Only filter is provided
        switch (filter) {
          case "my":
            return query.where(eq(experiments.createdBy, userId));

          case "member":
            return query
              .innerJoin(
                experimentMembers,
                eq(experiments.id, experimentMembers.experimentId),
              )
              .where(eq(experimentMembers.userId, userId));

          case "related":
            return query
              .leftJoin(
                experimentMembers,
                eq(experiments.id, experimentMembers.experimentId),
              )
              .where(
                or(
                  eq(experiments.createdBy, userId),
                  eq(experimentMembers.userId, userId),
                )
              );
              
          default:
            return query;
        }
      } else if (status) {
        // Only status is provided
        return query.where(eq(experiments.status, status));
      } else {
        // No filters provided
        return query;
      }
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
        .set({
          ...updateExperimentDto,
          updatedAt: new Date(), // Explicitly set the updatedAt field to current date/time
        })
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

  async hasAccess(
    experimentId: string,
    userId: string,
  ): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const experiment = await this.database
        .select()
        .from(experiments)
        .where(eq(experiments.id, experimentId))
        .limit(1);

      // If experiment doesn't exist, no access
      if (experiment.length === 0) {
        return false;
      }

      // If user created the experiment, they have access
      if (experiment[0].createdBy === userId) {
        return true;
      }

      // Check if user is a member
      const membership = await this.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.userId, userId),
          ),
        )
        .limit(1);

      return membership.length > 0;
    });
  }
}
