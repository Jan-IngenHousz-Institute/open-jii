import { Injectable, Inject } from "@nestjs/common";
import { db, experiments, eq, or, experimentMembers } from "database";

import type { ExperimentFilter } from "./pipes/experiment-filter.pipe";
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "./schemas/experiment.schema";

@Injectable()
export class ExperimentsService {
  constructor(
    @Inject("DATABASE")
    private readonly database: typeof db,
  ) {}

  async create(createExperimentDto: CreateExperimentDto, userId: string) {
    return this.database.insert(experiments).values({
      ...createExperimentDto,
      createdBy: userId,
    });
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
}
