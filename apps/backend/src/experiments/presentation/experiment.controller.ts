import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UsePipes,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { z } from "validator";

import {
  ExperimentFilterPipe,
  type ExperimentFilter,
} from "../application/pipes/experiment-filter.pipe";
import { AddExperimentMemberUseCase } from "../application/use-cases/add-experiment-member.use-case";
import type { AddMemberDto } from "../application/use-cases/add-experiment-member.use-case";
import { CreateExperimentUseCase } from "../application/use-cases/create-experiment.use-case";
import { DeleteExperimentUseCase } from "../application/use-cases/delete-experiment.use-case";
import { GetExperimentUseCase } from "../application/use-cases/get-experiment.use-case";
import { ListExperimentMembersUseCase } from "../application/use-cases/list-experiment-members.use-case";
import { ListExperimentsUseCase } from "../application/use-cases/list-experiments.use-case";
import { RemoveExperimentMemberUseCase } from "../application/use-cases/remove-experiment-member.use-case";
import { UpdateExperimentUseCase } from "../application/use-cases/update-experiment.use-case";
import {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "../core/models/experiment.model";
import {
  createExperimentSchema,
  updateExperimentSchema,
} from "../core/models/experiment.model";

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "member"]).optional(),
});

@Controller("experiments")
export class ExperimentController {
  constructor(
    private readonly createExperimentUseCase: CreateExperimentUseCase,
    private readonly getExperimentUseCase: GetExperimentUseCase,
    private readonly listExperimentsUseCase: ListExperimentsUseCase,
    private readonly updateExperimentUseCase: UpdateExperimentUseCase,
    private readonly deleteExperimentUseCase: DeleteExperimentUseCase,
    private readonly addExperimentMemberUseCase: AddExperimentMemberUseCase,
    private readonly removeExperimentMemberUseCase: RemoveExperimentMemberUseCase,
    private readonly listExperimentMembersUseCase: ListExperimentMembersUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createExperimentSchema))
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createExperimentDto: CreateExperimentDto,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.createExperimentUseCase.execute(createExperimentDto, userId);
  }

  @Get()
  findAll(
    @Query("userId", ParseUUIDPipe) userId: string,
    @Query("filter", ExperimentFilterPipe) filter?: ExperimentFilter,
  ) {
    return this.listExperimentsUseCase.execute(userId, filter);
  }

  @Get(":id")
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.getExperimentUseCase.execute(id);
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(updateExperimentSchema))
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateExperimentDto: UpdateExperimentDto,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.updateExperimentUseCase.execute(id, updateExperimentDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    await this.deleteExperimentUseCase.execute(id, userId);
  }

  @Get(":id/members")
  getMembers(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.listExperimentMembersUseCase.execute(id, userId);
  }

  @Post(":id/members")
  @UsePipes(new ZodValidationPipe(addMemberSchema))
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() addMemberDto: AddMemberDto,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.addExperimentMemberUseCase.execute(id, addMemberDto, userId);
  }

  @Delete(":id/members/:memberId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Query("userId", ParseUUIDPipe) userId: string,
  ) {
    await this.removeExperimentMemberUseCase.execute(id, memberId, userId);
  }
}
