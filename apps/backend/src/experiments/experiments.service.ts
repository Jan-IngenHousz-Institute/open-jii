import { Injectable, Inject } from "@nestjs/common";
import { db, experiments, eq, and, experimentMembers } from "database";

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

  async findAll(userId?: string, filter?: ExperimentFilter) {
    if (!userId) {
      return this.database.select().from(experiments);
    }

    if (filter === "my") {
      return this.database
        .select()
        .from(experiments)
        .where(eq(experiments.createdBy, userId));
    }

    if (filter === "member") {
      return this.database
        .select({
          id: experiments.id,
          name: experiments.name,
          status: experiments.status,
          visibility: experiments.visibility,
          embargoIntervalDays: experiments.embargoIntervalDays,
          createdBy: experiments.createdBy,
        })
        .from(experiments)
        .innerJoin(
          experimentMembers,
          eq(experiments.id, experimentMembers.experimentId),
        )
        .where(eq(experimentMembers.userId, userId));
    }

    if (filter === "related") {
      return this.database
        .select({
          id: experiments.id,
          name: experiments.name,
          status: experiments.status,
          visibility: experiments.visibility,
          embargoIntervalDays: experiments.embargoIntervalDays,
          createdBy: experiments.createdBy,
        })
        .from(experiments)
        .leftJoin(
          experimentMembers,
          eq(experiments.id, experimentMembers.experimentId),
        )
        .where(
          and(
            eq(experiments.createdBy, userId),
            eq(experimentMembers.userId, userId),
          ),
        );
    }

    return this.database.select().from(experiments);
  }

  async findOne(id: string) {
    return this.database
      .select()
      .from(experiments)
      .where(eq(experiments.id, id))
      .limit(1);
  }

  async update(id: string, updateExperimentDto: UpdateExperimentDto) {
    return this.database
      .update(experiments)
      .set(updateExperimentDto)
      .where(eq(experiments.id, id));
  }
}
