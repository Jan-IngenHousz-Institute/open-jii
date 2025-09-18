import { Module } from "@nestjs/common";

// Adapters & External Modules
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
// Services
import { EmbargoProcessorService } from "./application/services/embargo-processor.service";
// Use Cases
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment/delete-experiment";
import { CreateExperimentDataCommentsUseCase } from "./application/use-cases/experiment-data-comments/create-experiment-data-comments";
import { DeleteExperimentDataCommentsUseCase } from "./application/use-cases/experiment-data-comments/delete-experiment-data-comments";
import { GetExperimentDataUseCase } from "./application/use-cases/experiment-data/get-experiment-data";
import { UploadAmbyteDataUseCase } from "./application/use-cases/experiment-data/upload-ambyte-data";
import { AddExperimentMembersUseCase } from "./application/use-cases/experiment-members/add-experiment-members";
import { ListExperimentMembersUseCase } from "./application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "./application/use-cases/experiment-members/remove-experiment-member";
import { AddExperimentProtocolsUseCase } from "./application/use-cases/experiment-protocols/add-experiment-protocols";
import { ListExperimentProtocolsUseCase } from "./application/use-cases/experiment-protocols/list-experiment-protocols";
import { RemoveExperimentProtocolUseCase } from "./application/use-cases/experiment-protocols/remove-experiment-protocol";
import { CreateFlowUseCase } from "./application/use-cases/flows/create-flow";
import { GetFlowUseCase } from "./application/use-cases/flows/get-flow";
import { UpdateFlowUseCase } from "./application/use-cases/flows/update-flow";
import { GetExperimentAccessUseCase } from "./application/use-cases/get-experiment-access/get-experiment-access";
import { GetExperimentUseCase } from "./application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "./application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "./application/use-cases/update-experiment/update-experiment";
import { UpdateProvisioningStatusUseCase } from "./application/use-cases/update-provisioning-status/update-provisioning-status";
// Ports
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
// Repositories
import { ExperimentDataCommentsRepository } from "./core/repositories/experiment-data-comments.repository";
import { ExperimentMemberRepository } from "./core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "./core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "./core/repositories/experiment.repository";
import { FlowRepository } from "./core/repositories/flow.repository";
// Controllers
import { ExperimentCommentsController } from "./presentation/experiment-comments.controller";
import { ExperimentDataController } from "./presentation/experiment-data.controller";
import { ExperimentFlowsController } from "./presentation/experiment-flows.controller";
import { ExperimentMembersController } from "./presentation/experiment-members.controller";
import { ExperimentProtocolsController } from "./presentation/experiment-protocols.controller";
import { ExperimentWebhookController } from "./presentation/experiment-webhook.controller";
import { ExperimentController } from "./presentation/experiment.controller";

@Module({
  imports: [DatabricksModule],
  controllers: [
    ExperimentController,
    ExperimentDataController,
    ExperimentFlowsController,
    ExperimentMembersController,
    ExperimentProtocolsController,
    ExperimentWebhookController,
    ExperimentCommentsController,
  ],
  providers: [
    // Port implementations
    {
      provide: DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },

    // Repositories
    ExperimentRepository,
    ExperimentMemberRepository,
    ExperimentProtocolRepository,
    ExperimentDataCommentsRepository,
    FlowRepository,

    // Services
    EmbargoProcessorService,

    // General experiment use cases
    CreateExperimentUseCase,
    GetExperimentUseCase,
    GetExperimentAccessUseCase,
    ListExperimentsUseCase,
    UpdateExperimentUseCase,
    DeleteExperimentUseCase,
    UpdateProvisioningStatusUseCase,

    // Experiment data use cases
    GetExperimentDataUseCase,
    UploadAmbyteDataUseCase,

    // Experiment data comment use cases
    CreateExperimentDataCommentsUseCase,
    DeleteExperimentDataCommentsUseCase,

    // Experiment member use cases
    ListExperimentMembersUseCase,
    AddExperimentMembersUseCase,
    RemoveExperimentMemberUseCase,

    // Experiment protocol use cases
    AddExperimentProtocolsUseCase,
    ListExperimentProtocolsUseCase,
    RemoveExperimentProtocolUseCase,

    // Flow use cases
    GetFlowUseCase,
    CreateFlowUseCase,
    UpdateFlowUseCase,
  ],
  exports: [ExperimentRepository, ExperimentMemberRepository],
})
export class ExperimentModule {}
