import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  UsePipes,
  NotFoundException,
} from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";

import { ExperimentsService } from "./experiments.service";
import {
  ExperimentFilterPipe,
  type ExperimentFilter,
} from "./pipes/experiment-filter.pipe";
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "./schemas/experiment.schema";
import {
  createExperimentSchema,
  updateExperimentSchema,
} from "./schemas/experiment.schema";

@Controller("experiments")
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createExperimentSchema))
  create(
    @Body() createExperimentDto: CreateExperimentDto,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.experimentsService.create(createExperimentDto, userId);
  }

  @Get()
  findAll(
    @Query("userId", ParseUUIDPipe) userId?: string,
    @Query("filter", ExperimentFilterPipe) filter?: ExperimentFilter,
  ) {
    return this.experimentsService.findAll(userId, filter);
  }

  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    const experiment = await this.experimentsService.findOne(id);
    if (!experiment) {
      throw new NotFoundException(`Experiment with ID ${id} not found`);
    }
    return experiment;
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(updateExperimentSchema))
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateExperimentDto: UpdateExperimentDto,
  ) {
    const experiment = await this.experimentsService.findOne(id);
    if (!experiment) {
      throw new NotFoundException(`Experiment with ID ${id} not found`);
    }
    return this.experimentsService.update(id, updateExperimentDto);
  }
}
