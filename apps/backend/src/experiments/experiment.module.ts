import { Module } from "@nestjs/common";

import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
// Adapters & External Modules
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { DeltaAdapter } from "../common/modules/delta/delta.adapter";
import { DeltaModule } from "../common/modules/delta/delta.module";
import { EmailAdapter } from "../common/modules/email/services/email.adapter";
import { EmailModule } from "../common/modules/email/services/email.module";
import { UserModule } from "../users/user.module";
// Services
import { EmbargoProcessorService } from "./application/services/embargo-processor.service";
// Use Cases
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment/delete-experiment";
import { AddAnnotationsUseCase } from "./application/use-cases/experiment-data-annotations/add-annotations/add-annotations";
import { DeleteAnnotationsUseCase } from "./application/use-cases/experiment-data-annotations/delete-annotations/delete-annotations";
import { UpdateAnnotationUseCase } from "./application/use-cases/experiment-data-annotations/update-annotation/update-annotation";
import { DownloadExportUseCase } from "./application/use-cases/experiment-data-exports/download-export";
import { InitiateExportUseCase } from "./application/use-cases/experiment-data-exports/initiate-export";
import { ListExportsUseCase } from "./application/use-cases/experiment-data-exports/list-exports";
import { GetExperimentDataUseCase } from "./application/use-cases/experiment-data/get-experiment-data/get-experiment-data";
import { GetExperimentTablesUseCase } from "./application/use-cases/experiment-data/get-experiment-tables";
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
import { CreateTransferRequestUseCase } from "./application/use-cases/project-transfer-requests/create-transfer-request/create-transfer-request";
import { ListTransferRequestsUseCase } from "./application/use-cases/project-transfer-requests/list-transfer-requests/list-transfer-requests";
import { UpdateExperimentUseCase } from "./application/use-cases/update-experiment/update-experiment";
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
// Ports
import { AWS_PORT } from "./core/ports/aws.port";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
import { DELTA_PORT } from "./core/ports/delta.port";
import { EMAIL_PORT } from "./core/ports/email.port";
// Repositories
import { ExperimentDataAnnotationsRepository } from "./core/repositories/experiment-data-annotations.repository";
import { ExperimentDataExportsRepository } from "./core/repositories/experiment-data-exports.repository";
// Repositories
import { ExperimentDataRepository } from "./core/repositories/experiment-data.repository";
import { LocationRepository } from "./core/repositories/experiment-location.repository";
import { ExperimentMemberRepository } from "./core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "./core/repositories/experiment-protocol.repository";
import { ExperimentVisualizationRepository } from "./core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "./core/repositories/experiment.repository";
import { FlowRepository } from "./core/repositories/flow.repository";
import { ProjectTransferRequestsRepository } from "./core/repositories/project-transfer-requests.repository";
// Controllers
import { ExperimentDataAnnotationsController } from "./presentation/experiment-data-annotations.controller";
import { ExperimentDataExportsController } from "./presentation/experiment-data-exports.controller";
import { ExperimentDataController } from "./presentation/experiment-data.controller";
import { ExperimentFlowsController } from "./presentation/experiment-flows.controller";
import { ExperimentLocationsController } from "./presentation/experiment-locations.controller";
import { ExperimentMembersController } from "./presentation/experiment-members.controller";
import { ExperimentProtocolsController } from "./presentation/experiment-protocols.controller";
import { ExperimentVisualizationsController } from "./presentation/experiment-visualizations.controller";
import { ExperimentController } from "./presentation/experiment.controller";
import { ProjectTransferRequestsController } from "./presentation/project-transfer-requests.controller";

@Module({
  imports: [DatabricksModule, AwsModule, EmailModule, UserModule, AnalyticsModule, DeltaModule],
  controllers: [
    ExperimentController,
    ExperimentDataController,
    ExperimentDataExportsController,
    ExperimentFlowsController,
    ExperimentMembersController,
    ExperimentProtocolsController,
    ExperimentVisualizationsController,
    ExperimentLocationsController,
    ExperimentDataAnnotationsController,
    ProjectTransferRequestsController,
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
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },
    {
      provide: DELTA_PORT,
      useExisting: DeltaAdapter,
    },

    // Repositories
    ExperimentRepository,
    ExperimentMemberRepository,
    ExperimentProtocolRepository,
    ExperimentDataAnnotationsRepository,
    ExperimentVisualizationRepository,
    ExperimentDataRepository,
    ExperimentDataExportsRepository,
    FlowRepository,
    LocationRepository,
    ProjectTransferRequestsRepository,

    // Services
    EmbargoProcessorService,

    // General experiment use cases
    CreateExperimentUseCase,
    GetExperimentUseCase,
    GetExperimentAccessUseCase,
    ListExperimentsUseCase,
    UpdateExperimentUseCase,
    DeleteExperimentUseCase,

    // Experiment data use cases
    GetExperimentDataUseCase,
    GetExperimentTablesUseCase,
    UploadAmbyteDataUseCase,
    InitiateExportUseCase,
    ListExportsUseCase,
    DownloadExportUseCase,

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

    // Experiment data annotation use cases
    AddAnnotationsUseCase,
    UpdateAnnotationUseCase,
    DeleteAnnotationsUseCase,

    // Project transfer request use cases
    CreateTransferRequestUseCase,
    ListTransferRequestsUseCase,
  ],
  exports: [ExperimentRepository, ExperimentMemberRepository],
})
export class ExperimentModule {}
