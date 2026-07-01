import { experimentCoreContract } from "./domains/experiment/experiment-core.contract";
import { experimentDashboardsContract } from "./domains/experiment/experiment-dashboards.contract";
import { experimentDataAnnotationsContract } from "./domains/experiment/experiment-data-annotations.contract";
import { experimentDataContract } from "./domains/experiment/experiment-data.contract";
import { experimentExportsContract } from "./domains/experiment/experiment-exports.contract";
import { experimentFlowsContract } from "./domains/experiment/experiment-flows.contract";
import { experimentJoinRequestsContract } from "./domains/experiment/experiment-join-requests.contract";
import { experimentLocationsContract } from "./domains/experiment/experiment-locations.contract";
import { experimentMembersContract } from "./domains/experiment/experiment-members.contract";
import { experimentMetadataContract } from "./domains/experiment/experiment-metadata.contract";
import { experimentProjectTransferWebhookContract } from "./domains/experiment/experiment-project-transfer-webhook.contract";
import { experimentTransferRequestsContract } from "./domains/experiment/experiment-transfer-requests.contract";
import { experimentUploadsContract } from "./domains/experiment/experiment-uploads.contract";
import { experimentVisualizationsContract } from "./domains/experiment/experiment-visualizations.contract";
import { experimentWorkbooksContract } from "./domains/experiment/experiment-workbooks.contract";
import { healthContract } from "./domains/health/health.contract";
import { iotContract } from "./domains/iot/iot.contract";
import { macroContract } from "./domains/macro/macro.contract";
import { protocolContract } from "./domains/protocol/protocol.contract";
import { userContract } from "./domains/user/user.contract";
import { workbookContract } from "./domains/workbook/workbook.contract";

// Aggregate oRPC contract router mirroring the ts-rest `contract` shape so the
// frontend clients call `orpc.<domain>.<endpoint>` exactly as they did with
// ts-rest. Each domain is flat; the experiment domain merges its sub-contracts.
// `uploadData` is intentionally absent (it is a native streaming endpoint).
export const contract = {
  experiments: {
    ...experimentCoreContract,
    ...experimentDataContract,
    ...experimentExportsContract,
    ...experimentUploadsContract,
    ...experimentDataAnnotationsContract,
    ...experimentLocationsContract,
    ...experimentMembersContract,
    ...experimentMetadataContract,
    ...experimentFlowsContract,
    ...experimentWorkbooksContract,
    ...experimentDashboardsContract,
    ...experimentVisualizationsContract,
    ...experimentJoinRequestsContract,
    ...experimentTransferRequestsContract,
    ...experimentProjectTransferWebhookContract,
  },
  health: healthContract,
  iot: iotContract,
  macros: macroContract,
  protocols: protocolContract,
  users: userContract,
  workbooks: workbookContract,
};
