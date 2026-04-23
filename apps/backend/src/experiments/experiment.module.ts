import { Module } from "@nestjs/common";

import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
// Adapters & External Modules
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { EmailAdapter } from "../common/modules/email/services/email.adapter";
import { EmailModule } from "../common/modules/email/services/email.module";
import { CreateMacroUseCase } from "../macros/application/use-cases/create-macro/create-macro";
import { DATABRICKS_PORT as MACRO_DATABRICKS_PORT } from "../macros/core/ports/databricks.port";
import { MacroModule } from "../macros/macro.module";
import { CreateProtocolUseCase } from "../protocols/application/use-cases/create-protocol/create-protocol";
import { ProtocolRepository } from "../protocols/core/repositories/protocol.repository";
import { UserModule } from "../users/user.module";
import { WorkbookModule } from "../workbooks/workbook.module";
// Services
import { EmbargoProcessorService } from "./application/services/embargo-processor.service";
import { AttachWorkbookUseCase } from "./application/use-cases/attach-workbook/attach-workbook";
// Use Cases
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment/delete-experiment";
import { DetachWorkbookUseCase } from "./application/use-cases/detach-workbook/detach-workbook";
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
import { CreateExperimentMetadataUseCase } from "./application/use-cases/experiment-metadata/create-experiment-metadata";
import { DeleteExperimentMetadataUseCase } from "./application/use-cases/experiment-metadata/delete-experiment-metadata";
import { GetExperimentMetadataUseCase } from "./application/use-cases/experiment-metadata/get-experiment-metadata";
import { UpdateExperimentMetadataUseCase } from "./application/use-cases/experiment-metadata/update-experiment-metadata";
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
import { ExecuteProjectTransferUseCase } from "./application/use-cases/project-transfer/execute-project-transfer";
import { UpdateExperimentUseCase } from "./application/use-cases/update-experiment/update-experiment";
import { UpgradeWorkbookVersionUseCase } from "./application/use-cases/upgrade-workbook-version/upgrade-workbook-version";
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
// Ports
import { AWS_PORT } from "./core/ports/aws.port";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
import { EMAIL_PORT } from "./core/ports/email.port";
// Repositories
import { ExperimentDataAnnotationsRepository } from "./core/repositories/experiment-data-annotations.repository";
import { ExperimentDataExportsRepository } from "./core/repositories/experiment-data-exports.repository";
// Repositories
import { ExperimentDataRepository } from "./core/repositories/experiment-data.repository";
import { LocationRepository } from "./core/repositories/experiment-location.repository";
import { ExperimentMemberRepository } from "./core/repositories/experiment-member.repository";
import { ExperimentMetadataRepository } from "./core/repositories/experiment-metadata.repository";
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
import { ExperimentMetadataController } from "./presentation/experiment-metadata.controller";
import { ExperimentVisualizationsController } from "./presentation/experiment-visualizations.controller";
import { ExperimentWorkbooksController } from "./presentation/experiment-workbooks.controller";
import { ExperimentController } from "./presentation/experiment.controller";
import { ProjectTransferRequestsController } from "./presentation/project-transfer-requests.controller";
import { ProjectTransferWebhookController } from "./presentation/project-transfer-webhook.controller";

@Module({
  imports: [
    DatabricksModule,
    AwsModule,
    EmailModule,
    AnalyticsModule,
    UserModule,
    MacroModule,
    WorkbookModule,
  ],
  controllers: [
    ExperimentController,
    ExperimentDataController,
    ExperimentDataExportsController,
    ExperimentFlowsController,
    ExperimentWorkbooksController,
    ExperimentMembersController,
    ExperimentMetadataController,
    ExperimentVisualizationsController,
    ExperimentLocationsController,
    ExperimentDataAnnotationsController,
    ProjectTransferRequestsController,
    ProjectTransferWebhookController,
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
      provide: MACRO_DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },

    // Repositories
    ExperimentRepository,
    ExperimentMemberRepository,
    ExperimentMetadataRepository,
    ExperimentDataAnnotationsRepository,
    ExperimentVisualizationRepository,
    ExperimentDataRepository,
    ExperimentDataExportsRepository,
    FlowRepository,
    LocationRepository,
    ProjectTransferRequestsRepository,

    // External domain repositories (for project transfer)
    ProtocolRepository,

    // External domain use cases (for project transfer)
    CreateProtocolUseCase,
    CreateMacroUseCase,

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

    // Workbook attachment use cases
    AttachWorkbookUseCase,
    DetachWorkbookUseCase,
    UpgradeWorkbookVersionUseCase,

    // Experiment data annotation use cases
    AddAnnotationsUseCase,
    UpdateAnnotationUseCase,
    DeleteAnnotationsUseCase,

    // Project transfer request use cases
    CreateTransferRequestUseCase,
    ListTransferRequestsUseCase,

    // Project transfer webhook use case
    ExecuteProjectTransferUseCase,
    // Experiment metadata use cases
    GetExperimentMetadataUseCase,
    CreateExperimentMetadataUseCase,
    UpdateExperimentMetadataUseCase,
    DeleteExperimentMetadataUseCase,
  ],
  exports: [ExperimentRepository, ExperimentMemberRepository],
})
export class ExperimentModule {}
