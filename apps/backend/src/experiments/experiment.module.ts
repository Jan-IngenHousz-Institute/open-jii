import { Module } from "@nestjs/common";

// Adapters & External Modules
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { EmailAdapter } from "../common/modules/email/services/email.adapter";
import { EmailModule } from "../common/modules/email/services/email.module";
// Services
import { EmbargoProcessorService } from "./application/services/embargo-processor.service";
// Use Cases
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment/delete-experiment";
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
import { UpdateExperimentMemberRoleUseCase } from "./application/use-cases/experiment-members/update-experiment-member-role";
import { AddExperimentProtocolsUseCase } from "./application/use-cases/experiment-protocols/add-experiment-protocols";
import { ListExperimentProtocolsUseCase } from "./application/use-cases/experiment-protocols/list-experiment-protocols";
import { RemoveExperimentProtocolUseCase } from "./application/use-cases/experiment-protocols/remove-experiment-protocol";
import { CreateExperimentVisualizationUseCase } from "./application/use-cases/experiment-visualizations/create-experiment-visualization";
import { DeleteExperimentVisualizationUseCase } from "./application/use-cases/experiment-visualizations/delete-experiment-visualization";
import { GetExperimentVisualizationUseCase } from "./application/use-cases/experiment-visualizations/get-experiment-visualization";
import { ListExperimentVisualizationsUseCase } from "./application/use-cases/experiment-visualizations/list-experiment-visualizations";
import { UpdateExperimentVisualizationUseCase } from "./application/use-cases/experiment-visualizations/update-experiment-visualization";
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
import { EMAIL_PORT } from "./core/ports/email.port";
import { LocationRepository } from "./core/repositories/experiment-location.repository";
// Repositories
import { ExperimentMemberRepository } from "./core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "./core/repositories/experiment-protocol.repository";
import { ExperimentVisualizationRepository } from "./core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "./core/repositories/experiment.repository";
import { FlowRepository } from "./core/repositories/flow.repository";
// Controllers
import { ExperimentDataController } from "./presentation/experiment-data.controller";
import { ExperimentFlowsController } from "./presentation/experiment-flows.controller";
import { ExperimentLocationsController } from "./presentation/experiment-locations.controller";
import { ExperimentMembersController } from "./presentation/experiment-members.controller";
import { ExperimentProtocolsController } from "./presentation/experiment-protocols.controller";
import { ExperimentVisualizationsController } from "./presentation/experiment-visualizations.controller";
import { ExperimentWebhookController } from "./presentation/experiment-webhook.controller";
import { ExperimentController } from "./presentation/experiment.controller";

@Module({
  imports: [DatabricksModule, AwsModule, EmailModule],
  controllers: [
    ExperimentController,
    ExperimentDataController,
    ExperimentFlowsController,
    ExperimentMembersController,
    ExperimentProtocolsController,
    ExperimentVisualizationsController,
    ExperimentWebhookController,
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
    {
      provide: EMAIL_PORT,
      useExisting: EmailAdapter,
    },

    // Repositories
    ExperimentRepository,
    ExperimentMemberRepository,
    ExperimentProtocolRepository,
    ExperimentVisualizationRepository,
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

    // Experiment member use cases
    ListExperimentMembersUseCase,
    AddExperimentMembersUseCase,
    RemoveExperimentMemberUseCase,
    UpdateExperimentMemberRoleUseCase,

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

    // Experiment visualization use cases
    ListExperimentVisualizationsUseCase,
    CreateExperimentVisualizationUseCase,
    GetExperimentVisualizationUseCase,
    UpdateExperimentVisualizationUseCase,
    DeleteExperimentVisualizationUseCase,

    // Flow use cases
    GetFlowUseCase,
    CreateFlowUseCase,
    UpdateFlowUseCase,
  ],
  exports: [ExperimentRepository, ExperimentMemberRepository],
})
export class ExperimentModule {}
