import { assistantKnowledgeContract } from "./domains/assistant-knowledge/assistant-knowledge.contract";
import { assistantContract } from "./domains/assistant/assistant.contract";
import { experimentContributorsContract } from "./domains/experiment/contributors/experiment-contributors.contract";
import { experimentDashboardsContract } from "./domains/experiment/dashboards/experiment-dashboards.contract";
import { experimentDataAnnotationsContract } from "./domains/experiment/data-annotations/experiment-data-annotations.contract";
import { experimentDataContract } from "./domains/experiment/data/experiment-data.contract";
import { experimentDevicesContract } from "./domains/experiment/devices/experiment-devices.contract";
import { experimentContract } from "./domains/experiment/experiment.contract";
import { experimentExportsContract } from "./domains/experiment/exports/experiment-exports.contract";
import { experimentFlowsContract } from "./domains/experiment/flows/experiment-flows.contract";
import { experimentJoinRequestsContract } from "./domains/experiment/join-requests/experiment-join-requests.contract";
import { experimentLocationsContract } from "./domains/experiment/locations/experiment-locations.contract";
import { experimentMetadataContract } from "./domains/experiment/metadata/experiment-metadata.contract";
import { experimentProjectTransferWebhookContract } from "./domains/experiment/project-transfer-webhook/experiment-project-transfer-webhook.contract";
import { experimentTransferRequestsContract } from "./domains/experiment/transfer-requests/experiment-transfer-requests.contract";
import { experimentUploadsContract } from "./domains/experiment/uploads/experiment-uploads.contract";
import { experimentVisualizationsContract } from "./domains/experiment/visualizations/experiment-visualizations.contract";
import { experimentWorkbooksContract } from "./domains/experiment/workbooks/experiment-workbooks.contract";
import { healthContract } from "./domains/health/health.contract";
import { iotDeviceGroupContract } from "./domains/iot/device-group/iot-device-group.contract";
import { iotFirmwareContract } from "./domains/iot/firmware/iot-firmware.contract";
import { iotContract } from "./domains/iot/iot.contract";
import { macroContract } from "./domains/macro/macro.contract";
import { metricsContract } from "./domains/metrics/metrics.contract";
import { newsletterContract } from "./domains/newsletter/newsletter.contract";
import { organizationJoinRequestsContract } from "./domains/organization/join-requests/organization-join-requests.contract";
import { organizationContract } from "./domains/organization/organization.contract";
import { protocolContract } from "./domains/protocol/protocol.contract";
import { searchContract } from "./domains/search/search.contract";
import { sharingContract } from "./domains/sharing/sharing.contract";
import { sharingTransferAdminContract } from "./domains/sharing/transfer-admin/sharing-transfer-admin.contract";
import { sharingTransferOrgContract } from "./domains/sharing/transfer-org/sharing-transfer-org.contract";
import { userContract } from "./domains/user/user.contract";
import { workbookContract } from "./domains/workbook/workbook.contract";

const experimentsContract = {
  ...experimentContract,
  ...experimentDataContract,
  ...experimentExportsContract,
  ...experimentUploadsContract,
  ...experimentDataAnnotationsContract,
  ...experimentLocationsContract,
  ...experimentContributorsContract,
  ...experimentDevicesContract,
  ...experimentMetadataContract,
  ...experimentFlowsContract,
  ...experimentWorkbooksContract,
  ...experimentDashboardsContract,
  ...experimentVisualizationsContract,
  ...experimentJoinRequestsContract,
  ...experimentTransferRequestsContract,
  ...experimentProjectTransferWebhookContract,
};
const iotContracts = { ...iotContract, ...iotDeviceGroupContract, ...iotFirmwareContract };
const organizationContracts = { ...organizationContract, ...organizationJoinRequestsContract };
const sharingContracts = {
  ...sharingContract,
  ...sharingTransferAdminContract,
  ...sharingTransferOrgContract,
};

// A type alias preserves oRPC's router index signature; an interface does not satisfy AnyContractRouter.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ApiContract = {
  assistant: typeof assistantContract;
  assistantKnowledge: typeof assistantKnowledgeContract;
  experiments: typeof experimentsContract;
  health: typeof healthContract;
  iot: typeof iotContracts;
  macros: typeof macroContract;
  metrics: typeof metricsContract;
  newsletter: typeof newsletterContract;
  organizations: typeof organizationContracts;
  protocols: typeof protocolContract;
  search: typeof searchContract;
  sharing: typeof sharingContracts;
  users: typeof userContract;
  workbooks: typeof workbookContract;
};

// Aggregate oRPC contract router mirroring the ts-rest `contract` shape so the
// frontend clients call `orpc.<domain>.<endpoint>` exactly as they did with
// ts-rest. Each domain is flat; the experiment domain merges its sub-contracts.
// `uploadData` is intentionally absent (it is a native streaming endpoint).
export const contract: ApiContract = {
  assistant: assistantContract,
  assistantKnowledge: assistantKnowledgeContract,
  experiments: experimentsContract,
  health: healthContract,
  iot: iotContracts,
  macros: macroContract,
  metrics: metricsContract,
  newsletter: newsletterContract,
  organizations: organizationContracts,
  protocols: protocolContract,
  search: searchContract,
  sharing: sharingContracts,
  users: userContract,
  workbooks: workbookContract,
};
