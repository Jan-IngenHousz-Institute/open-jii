import { experimentCoreOrpcContract } from "./domains/experiment/experiment-core.orpc";
import { experimentDashboardsOrpcContract } from "./domains/experiment/experiment-dashboards.orpc";
import { experimentDataAnnotationsOrpcContract } from "./domains/experiment/experiment-data-annotations.orpc";
import { experimentDataOrpcContract } from "./domains/experiment/experiment-data.orpc";
import { experimentExportsOrpcContract } from "./domains/experiment/experiment-exports.orpc";
import { experimentFlowsOrpcContract } from "./domains/experiment/experiment-flows.orpc";
import { experimentJoinRequestsOrpcContract } from "./domains/experiment/experiment-join-requests.orpc";
import { experimentLocationsOrpcContract } from "./domains/experiment/experiment-locations.orpc";
import { experimentMembersOrpcContract } from "./domains/experiment/experiment-members.orpc";
import { experimentMetadataOrpcContract } from "./domains/experiment/experiment-metadata.orpc";
import { experimentProjectTransferWebhookOrpcContract } from "./domains/experiment/experiment-project-transfer-webhook.orpc";
import { experimentTransferRequestsOrpcContract } from "./domains/experiment/experiment-transfer-requests.orpc";
import { experimentUploadsOrpcContract } from "./domains/experiment/experiment-uploads.orpc";
import { experimentVisualizationsOrpcContract } from "./domains/experiment/experiment-visualizations.orpc";
import { experimentWorkbooksOrpcContract } from "./domains/experiment/experiment-workbooks.orpc";
import { healthOrpcContract } from "./domains/health/health.orpc";
import { iotOrpcContract } from "./domains/iot/iot.orpc";
import { macroOrpcContract } from "./domains/macro/macro.orpc";
import { protocolOrpcContract } from "./domains/protocol/protocol.orpc";
import { userOrpcContract } from "./domains/user/user.orpc";
import { workbookOrpcContract } from "./domains/workbook/workbook.orpc";

// Aggregate oRPC contract router mirroring the ts-rest `contract` shape so the
// frontend clients call `orpc.<domain>.<endpoint>` exactly as they did with
// ts-rest. Each domain is flat; the experiment domain merges its sub-contracts.
// `uploadData` is intentionally absent (it is a native streaming endpoint).
export const orpcContract = {
  experiments: {
    ...experimentCoreOrpcContract,
    ...experimentDataOrpcContract,
    ...experimentExportsOrpcContract,
    ...experimentUploadsOrpcContract,
    ...experimentDataAnnotationsOrpcContract,
    ...experimentLocationsOrpcContract,
    ...experimentMembersOrpcContract,
    ...experimentMetadataOrpcContract,
    ...experimentFlowsOrpcContract,
    ...experimentWorkbooksOrpcContract,
    ...experimentDashboardsOrpcContract,
    ...experimentVisualizationsOrpcContract,
    ...experimentJoinRequestsOrpcContract,
    ...experimentTransferRequestsOrpcContract,
    ...experimentProjectTransferWebhookOrpcContract,
  },
  health: healthOrpcContract,
  iot: iotOrpcContract,
  macros: macroOrpcContract,
  protocols: protocolOrpcContract,
  users: userOrpcContract,
  workbooks: workbookOrpcContract,
};
