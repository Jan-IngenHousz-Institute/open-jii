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
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.experimentsService.findOne(id);
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(updateExperimentSchema))
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateExperimentDto: UpdateExperimentDto,
  ) {
    return this.experimentsService.update(id, updateExperimentDto);
  }
}
