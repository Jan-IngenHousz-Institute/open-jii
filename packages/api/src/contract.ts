import { experimentDashboardsContract } from "./domains/experiment/dashboards/experiment-dashboards.contract";
import { experimentDataAnnotationsContract } from "./domains/experiment/data-annotations/experiment-data-annotations.contract";
import { experimentDataContract } from "./domains/experiment/data/experiment-data.contract";
import { experimentContract } from "./domains/experiment/experiment.contract";
import { experimentExportsContract } from "./domains/experiment/exports/experiment-exports.contract";
import { experimentFlowsContract } from "./domains/experiment/flows/experiment-flows.contract";
import { experimentJoinRequestsContract } from "./domains/experiment/join-requests/experiment-join-requests.contract";
import { experimentLocationsContract } from "./domains/experiment/locations/experiment-locations.contract";
import { experimentMembersContract } from "./domains/experiment/members/experiment-members.contract";
import { experimentMetadataContract } from "./domains/experiment/metadata/experiment-metadata.contract";
import { experimentProjectTransferWebhookContract } from "./domains/experiment/project-transfer-webhook/experiment-project-transfer-webhook.contract";
import { experimentTransferRequestsContract } from "./domains/experiment/transfer-requests/experiment-transfer-requests.contract";
import { experimentUploadsContract } from "./domains/experiment/uploads/experiment-uploads.contract";
import { experimentVisualizationsContract } from "./domains/experiment/visualizations/experiment-visualizations.contract";
import { experimentWorkbooksContract } from "./domains/experiment/workbooks/experiment-workbooks.contract";
import { healthContract } from "./domains/health/health.contract";
import { iotContract } from "./domains/iot/iot.contract";
import { macroContract } from "./domains/macro/macro.contract";
import { newsletterContract } from "./domains/newsletter/newsletter.contract";
import { protocolContract } from "./domains/protocol/protocol.contract";
import { searchContract } from "./domains/search/search.contract";
import { userContract } from "./domains/user/user.contract";
import { workbookContract } from "./domains/workbook/workbook.contract";

// Aggregate oRPC contract router mirroring the ts-rest `contract` shape so the
// frontend clients call `orpc.<domain>.<endpoint>` exactly as they did with
// ts-rest. Each domain is flat; the experiment domain merges its sub-contracts.
// `uploadData` is intentionally absent (it is a native streaming endpoint).
export const contract = {
  experiments: {
    ...experimentContract,
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
  newsletter: newsletterContract,
  protocols: protocolContract,
  search: searchContract,
  users: userContract,
  workbooks: workbookContract,
};
