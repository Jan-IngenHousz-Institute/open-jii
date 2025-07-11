import { Module } from "@nestjs/common";

import { DatabricksModule } from "../common/services/databricks/databricks.module";
// Use Cases
import { ChangeExperimentStatusUseCase } from "./application/use-cases/change-experiment-status/change-experiment-status";
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment/delete-experiment";
import { GetExperimentDataUseCase } from "./application/use-cases/experiment-data/get-experiment-data";
import { AddExperimentMembersUseCase } from "./application/use-cases/experiment-members/add-experiment-members";
import { ListExperimentMembersUseCase } from "./application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "./application/use-cases/experiment-members/remove-experiment-member";
import { AddExperimentProtocolsUseCase } from "./application/use-cases/experiment-protocols/add-experiment-protocols";
import { ListExperimentProtocolsUseCase } from "./application/use-cases/experiment-protocols/list-experiment-protocols";
import { RemoveExperimentProtocolUseCase } from "./application/use-cases/experiment-protocols/remove-experiment-protocol";
import { GetExperimentUseCase } from "./application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "./application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "./application/use-cases/update-experiment/update-experiment";
import { UpdateProvisioningStatusUseCase } from "./application/use-cases/update-provisioning-status/update-provisioning-status";
// Repositories
import { ExperimentMemberRepository } from "./core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "./core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "./core/repositories/experiment.repository";
// Controllers
import { ExperimentDataController } from "./presentation/experiment-data.controller";
import { ExperimentMembersController } from "./presentation/experiment-members.controller";
import { ExperimentProtocolsController } from "./presentation/experiment-protocols.controller";
import { ExperimentWebhookController } from "./presentation/experiment-webhook.controller";
import { ExperimentController } from "./presentation/experiment.controller";

@Module({
  imports: [DatabricksModule],
  controllers: [
    ExperimentController,
    ExperimentDataController,
    ExperimentMembersController,
    ExperimentWebhookController,
    ExperimentProtocolsController,
  ],
  providers: [
    // Repositories
    ExperimentRepository,
    ExperimentMemberRepository,
    ExperimentProtocolRepository,

    // General experiment use cases
    CreateExperimentUseCase,
    GetExperimentUseCase,
    ListExperimentsUseCase,
    UpdateExperimentUseCase,
    DeleteExperimentUseCase,
    ChangeExperimentStatusUseCase,
    UpdateProvisioningStatusUseCase,

    // Experiment data use cases
    GetExperimentDataUseCase,

    // Experiment member use cases
    ListExperimentMembersUseCase,
    AddExperimentMembersUseCase,
    RemoveExperimentMemberUseCase,

    // Experiment protocol use cases
    AddExperimentProtocolsUseCase,
    ListExperimentProtocolsUseCase,
    RemoveExperimentProtocolUseCase,
  ],
  exports: [ExperimentRepository, ExperimentMemberRepository],
})
export class ExperimentModule {}
