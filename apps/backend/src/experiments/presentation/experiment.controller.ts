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

import {
  ExperimentFilterPipe,
  type ExperimentFilter,
} from "./application/pipes/experiment-filter.pipe";
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment.use-case";
import { GetExperimentUseCase } from "./application/use-cases/get-experiment.use-case";
import { ListExperimentsUseCase } from "./application/use-cases/list-experiments.use-case";
import { UpdateExperimentUseCase } from "./application/use-cases/update-experiment.use-case";
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "./core/schemas/experiment.schema";
import {
  createExperimentSchema,
  updateExperimentSchema,
} from "./core/schemas/experiment.schema";

@Controller("experiments")
export class ExperimentController {
  constructor(
    private readonly createExperimentUseCase: CreateExperimentUseCase,
    private readonly getExperimentUseCase: GetExperimentUseCase,
    private readonly listExperimentsUseCase: ListExperimentsUseCase,
    private readonly updateExperimentUseCase: UpdateExperimentUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createExperimentSchema))
  create(
    @Body() createExperimentDto: CreateExperimentDto,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.createExperimentUseCase.execute(createExperimentDto, userId);
  }

  @Get()
  findAll(
    @Query("userId", ParseUUIDPipe) userId: string, // for later we will use auth guard
    @Query("filter", ExperimentFilterPipe) filter?: ExperimentFilter,
  ) {
    return this.listExperimentsUseCase.execute(userId, filter);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.getExperimentUseCase.execute(id);
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(updateExperimentSchema))
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateExperimentDto: UpdateExperimentDto,
  ) {
    return this.updateExperimentUseCase.execute(id, updateExperimentDto);
  }
}
