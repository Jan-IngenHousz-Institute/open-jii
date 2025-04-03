import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import type { CreateExperimentDto, UpdateExperimentDto } from './schemas/experiment.schema';
import { ExperimentFilterPipe, type ExperimentFilter } from './pipes/experiment-filter.pipe';

@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Post()
  create(
    @Body() createExperimentDto: CreateExperimentDto,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.experimentsService.create(createExperimentDto, userId);
  }

  @Get()
  findAll(
    @Query('userId', ParseUUIDPipe) userId?: string,
    @Query('filter', ExperimentFilterPipe) filter?: ExperimentFilter,
  ) {
    return this.experimentsService.findAll(userId, filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.experimentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExperimentDto: UpdateExperimentDto,
  ) {
    return this.experimentsService.update(id, updateExperimentDto);
  }
} 