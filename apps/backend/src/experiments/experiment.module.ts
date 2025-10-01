import { Module } from "@nestjs/common";

// Adapters & External Modules
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
// Services
import { EmbargoProcessorService } from "./application/services/embargo-processor.service";
// Use Cases
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment/delete-experiment";
import { CreateExperimentDataCommentsUseCase } from "./application/use-cases/experiment-data-comments/create-experiment-data-comments";
import { DeleteExperimentDataCommentsUseCase } from "./application/use-cases/experiment-data-comments/delete-experiment-data-comments";
import { DownloadExperimentDataUseCase } from "./application/use-cases/experiment-data/download-experiment-data";
import { GetExperimentDataUseCase } from "./application/use-cases/experiment-data/get-experiment-data";
import { UploadAmbyteDataUseCase } from "./application/use-cases/experiment-data/upload-ambyte-data";
import { AddExperimentLocationsUseCase } from "./application/use-cases/experiment-locations/add-experiment-locations";
import { GeocodeLocationUseCase } from "./application/use-cases/experiment-locations/geocode-location";
import { GetExperimentLocationsUseCase } from "./application/use-cases/experiment-locations/get-experiment-locations";
import { SearchPlacesUseCase } from "./application/use-cases/experiment-locations/search-places";
import { UpdateExperimentLocationsUseCase } from "./application/use-cases/experiment-locations/update-experiment-locations";
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
import { AWS_PORT } from "./core/ports/aws.port";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
// Repositories
import { LocationRepository } from "./core/repositories/experiment-location.repository";
import { ExperimentMemberRepository } from "./core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "./core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "./core/repositories/experiment.repository";
import { FlowRepository } from "./core/repositories/flow.repository";
// Controllers
import { ExperimentCommentsController } from "./presentation/experiment-comments.controller";
import { ExperimentDataController } from "./presentation/experiment-data.controller";
import { ExperimentFlowsController } from "./presentation/experiment-flows.controller";
import { ExperimentLocationsController } from "./presentation/experiment-locations.controller";
import { ExperimentMembersController } from "./presentation/experiment-members.controller";
import { ExperimentProtocolsController } from "./presentation/experiment-protocols.controller";
import { ExperimentWebhookController } from "./presentation/experiment-webhook.controller";
import { ExperimentController } from "./presentation/experiment.controller";

@Module({
  imports: [DatabricksModule, AwsModule],
  controllers: [
    ExperimentController,
    ExperimentDataController,
    ExperimentFlowsController,
    ExperimentMembersController,
    ExperimentProtocolsController,
    ExperimentWebhookController,
    ExperimentCommentsController,
    ExperimentLocationsController,
  ],
  providers: [
    // Port implementations
    {
      provide: DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
    {
      provide: AWS_PORT,
      useExisting: AwsAdapter,
    },

    // Repositories
    ExperimentRepository,
    ExperimentMemberRepository,
    ExperimentProtocolRepository,
    FlowRepository,
    LocationRepository,

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
    DownloadExperimentDataUseCase,

    // Experiment data comment use cases
    CreateExperimentDataCommentsUseCase,
    DeleteExperimentDataCommentsUseCase,

    // Experiment member use cases
    ListExperimentMembersUseCase,
    AddExperimentMembersUseCase,
    RemoveExperimentMemberUseCase,

    // Experiment location use cases
    GetExperimentLocationsUseCase,
    AddExperimentLocationsUseCase,
    UpdateExperimentLocationsUseCase,
    SearchPlacesUseCase,
    GeocodeLocationUseCase,

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
