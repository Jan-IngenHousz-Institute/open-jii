import { Module } from "@nestjs/common";

import { ExperimentFilterPipe } from "./application/pipes/experiment-filter.pipe";
import { AddExperimentMemberUseCase } from "./application/use-cases/add-experiment-member.use-case";
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment.use-case";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment.use-case";
import { GetExperimentUseCase } from "./application/use-cases/get-experiment.use-case";
import { ListExperimentMembersUseCase } from "./application/use-cases/list-experiment-members.use-case";
import { ListExperimentsUseCase } from "./application/use-cases/list-experiments.use-case";
import { RemoveExperimentMemberUseCase } from "./application/use-cases/remove-experiment-member.use-case";
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
    DeleteExperimentUseCase,
    AddExperimentMemberUseCase,
    RemoveExperimentMemberUseCase,
    ListExperimentMembersUseCase,
    ExperimentFilterPipe,
  ],
})
export class ExperimentModule {}
