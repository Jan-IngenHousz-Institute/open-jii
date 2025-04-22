import { Injectable, Inject } from "@nestjs/common";

import { eq, or, and, experiments, experimentMembers } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import type { ExperimentFilter } from "../../application/pipes/experiment-filter.pipe";
import {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "../models/experiment.model";

@Injectable()
export class ExperimentRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(createExperimentDto: CreateExperimentDto, userId: string) {
    const result = await this.database
      .insert(experiments)
      .values({
        ...createExperimentDto,
        createdBy: userId,
      })
      .returning({ id: experiments.id });

    return result[0].id;
  }

  async findAll(userId: string, filter?: ExperimentFilter) {
    // Common experiment fields to select
    const experimentFields = {
      id: experiments.id,
      name: experiments.name,
      status: experiments.status,
      visibility: experiments.visibility,
      embargoIntervalDays: experiments.embargoIntervalDays,
      createdBy: experiments.createdBy,
    };
    // Start with a base query builder
    let query = this.database.select(experimentFields).from(experiments);

    // Apply filters based on the filter type
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
            ),
          );

      default:
        return query;
    }
  }

  async findOne(id: string) {
    const result = await this.database
      .select()
      .from(experiments)
      .where(eq(experiments.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  }

  async update(id: string, updateExperimentDto: UpdateExperimentDto) {
    return this.database
      .update(experiments)
      .set(updateExperimentDto)
      .where(eq(experiments.id, id));
  }

  async delete(id: string) {
    // First delete experiment members to maintain referential integrity
    await this.database
      .delete(experimentMembers)
      .where(eq(experimentMembers.experimentId, id));

    // Then delete the experiment
    return this.database.delete(experiments).where(eq(experiments.id, id));
  }

  async addMember(
    experimentId: string,
    userId: string,
    role: "admin" | "member" = "member",
  ) {
    // Check if membership already exists
    const existingMembership = await this.database
      .select()
      .from(experimentMembers)
      .where(
        and(
          eq(experimentMembers.experimentId, experimentId),
          eq(experimentMembers.userId, userId),
        ),
      )
      .limit(1);

    // If already a member, update role instead of creating duplicate
    if (existingMembership.length > 0) {
      return this.database
        .update(experimentMembers)
        .set({ role })
        .where(eq(experimentMembers.id, existingMembership[0].id))
        .returning();
    }

    // Otherwise, add new membership
    return this.database
      .insert(experimentMembers)
      .values({
        experimentId,
        userId,
        role,
      })
      .returning();
  }

  async removeMember(experimentId: string, userId: string) {
    return this.database
      .delete(experimentMembers)
      .where(
        and(
          eq(experimentMembers.experimentId, experimentId),
          eq(experimentMembers.userId, userId),
        ),
      );
  }

  async hasAccess(experimentId: string, userId: string): Promise<boolean> {
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
  }

  async getMembers(experimentId: string) {
    return this.database
      .select({
        id: experimentMembers.id,
        userId: experimentMembers.userId,
        role: experimentMembers.role,
        joinedAt: experimentMembers.joinedAt,
      })
      .from(experimentMembers)
      .where(eq(experimentMembers.experimentId, experimentId));
  }
}
