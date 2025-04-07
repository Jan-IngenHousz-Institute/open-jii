import { Module } from "@nestjs/common";

import { ExperimentFilterPipe } from "./application/pipes/experiment-filter.pipe";
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment.use-case";
import { GetExperimentUseCase } from "./application/use-cases/get-experiment.use-case";
import { ListExperimentsUseCase } from "./application/use-cases/list-experiments.use-case";
import { UpdateExperimentUseCase } from "./application/use-cases/update-experiment.use-case";
import { ExperimentRepository } from "./core/repositories/experiment.repository";
import { ExperimentController } from "./presentation/experiment.controller";

@Module({
  controllers: [ExperimentController],
  providers: [
    ExperimentRepository,
    CreateExperimentUseCase,
    GetExperimentUseCase,
    ListExperimentsUseCase,
    UpdateExperimentUseCase,
    ExperimentFilterPipe,
  ],
})
export class ExperimentModule {}
