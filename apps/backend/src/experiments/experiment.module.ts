import { Module } from "@nestjs/common";

import { ExperimentFilterPipe } from "./application/pipes/experiment-filter.pipe";
// Use Cases
import { ChangeExperimentStatusUseCase } from "./application/use-cases/change-experiment-status/change-experiment-status";
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment/delete-experiment";
import { AddExperimentMemberUseCase } from "./application/use-cases/experiment-members/add-experiment-member";
import { ListExperimentMembersUseCase } from "./application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "./application/use-cases/experiment-members/remove-experiment-member";
import { GetExperimentUseCase } from "./application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "./application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "./application/use-cases/update-experiment/update-experiment";
// Repository
import { ExperimentRepository } from "./core/repositories/experiment.repository";
import { ExperimentMembersController } from "./presentation/experiment-members.controller";
// Controllers
import { ExperimentController } from "./presentation/experiment.controller";

@Module({
  controllers: [ExperimentController, ExperimentMembersController],
  providers: [
    // Repository
    ExperimentRepository,

    // Use case providers
    CreateExperimentUseCase,
    GetExperimentUseCase,
    ListExperimentsUseCase,
    UpdateExperimentUseCase,
    DeleteExperimentUseCase,
    ChangeExperimentStatusUseCase,

    // Experiment member use cases
    ListExperimentMembersUseCase,
    AddExperimentMemberUseCase,
    RemoveExperimentMemberUseCase,
    ListExperimentMembersUseCase,
    ExperimentFilterPipe,
  ],
  exports: [ExperimentRepository],
})
export class ExperimentModule {}
