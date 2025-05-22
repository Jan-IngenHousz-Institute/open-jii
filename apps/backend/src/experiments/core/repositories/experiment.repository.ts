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
      let filteredQuery;

      // Apply filters based on the filter type
      switch (filter) {
        case "my":
          filteredQuery = query.where(eq(experiments.createdBy, userId));
          break;

        case "member":
          filteredQuery = query
            .innerJoin(
              experimentMembers,
              eq(experiments.id, experimentMembers.experimentId),
            )
            .where(eq(experimentMembers.userId, userId));
          break;

        case "related":
          filteredQuery = query
            .leftJoin(
              experimentMembers,
              eq(experiments.id, experimentMembers.experimentId),
            )
            .where(
              or(
                eq(experiments.createdBy, userId),
                eq(experimentMembers.userId, userId),
              ),
            );
          break;

        default:
          filteredQuery = query;
          break;
      }

      // Apply status filter if provided
      if (status) {
        return filteredQuery.where(eq(experiments.status, status));
      }

      return filteredQuery;
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
