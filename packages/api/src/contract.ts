import { datasetContract } from "./domains/dataset/dataset.contract";
import { experimentColumnsContract } from "./domains/experiment/columns/experiment-columns.contract";
import { experimentContributorsContract } from "./domains/experiment/contributors/experiment-contributors.contract";
import { experimentDashboardsContract } from "./domains/experiment/dashboards/experiment-dashboards.contract";
import { experimentDataAnnotationsContract } from "./domains/experiment/data-annotations/experiment-data-annotations.contract";
import { experimentDataContract } from "./domains/experiment/data/experiment-data.contract";
import { experimentDevicesContract } from "./domains/experiment/devices/experiment-devices.contract";
import { experimentContract } from "./domains/experiment/experiment.contract";
import { experimentExportsContract } from "./domains/experiment/exports/experiment-exports.contract";
import { experimentFlowsContract } from "./domains/experiment/flows/experiment-flows.contract";
import { experimentJoinCodesContract } from "./domains/experiment/join-codes/experiment-join-codes.contract";
import { experimentJoinRequestsContract } from "./domains/experiment/join-requests/experiment-join-requests.contract";
import { experimentLayoutContract } from "./domains/experiment/layout/experiment-layout.contract";
import { experimentLocationsContract } from "./domains/experiment/locations/experiment-locations.contract";
import { experimentMetadataContract } from "./domains/experiment/metadata/experiment-metadata.contract";
import { experimentProjectTransferWebhookContract } from "./domains/experiment/project-transfer-webhook/experiment-project-transfer-webhook.contract";
import { experimentSessionsContract } from "./domains/experiment/sessions/experiment-sessions.contract";
import { experimentStandardsContract } from "./domains/experiment/standards/experiment-standards.contract";
import { experimentStudyContract } from "./domains/experiment/study/experiment-study.contract";
import { experimentTransferRequestsContract } from "./domains/experiment/transfer-requests/experiment-transfer-requests.contract";
import { experimentUploadWebhookContract } from "./domains/experiment/upload-webhook/experiment-upload-webhook.contract";
import { experimentUploadsContract } from "./domains/experiment/uploads/experiment-uploads.contract";
import { experimentVisualizationsContract } from "./domains/experiment/visualizations/experiment-visualizations.contract";
import { experimentWorkbooksContract } from "./domains/experiment/workbooks/experiment-workbooks.contract";
import { healthContract } from "./domains/health/health.contract";
import { iotCalibrationContract } from "./domains/iot/calibration/iot-calibration.contract";
import { iotDeviceGroupContract } from "./domains/iot/device-group/iot-device-group.contract";
import { iotFirmwareContract } from "./domains/iot/firmware/iot-firmware.contract";
import { iotContract } from "./domains/iot/iot.contract";
import { macroContract } from "./domains/macro/macro.contract";
import { metricsContract } from "./domains/metrics/metrics.contract";
import { newsletterContract } from "./domains/newsletter/newsletter.contract";
import { notificationContract } from "./domains/notification/notification.contract";
import { organizationJoinRequestsContract } from "./domains/organization/join-requests/organization-join-requests.contract";
import { organizationContract } from "./domains/organization/organization.contract";
import { protocolContract } from "./domains/protocol/protocol.contract";
import { searchContract } from "./domains/search/search.contract";
import { sharingContract } from "./domains/sharing/sharing.contract";
import { sharingTransferAdminContract } from "./domains/sharing/transfer-admin/sharing-transfer-admin.contract";
import { sharingTransferOrgContract } from "./domains/sharing/transfer-org/sharing-transfer-org.contract";
import { userContract } from "./domains/user/user.contract";
import { visitContract } from "./domains/visit/visit.contract";
import { workbookContract } from "./domains/workbook/workbook.contract";

// The merged groups carry named types, because the root contract's inferred type is otherwise
// too large for the declaration emit (TS7056).
export type ExperimentsContract = typeof experimentContract &
  typeof experimentDataContract &
  typeof experimentExportsContract &
  typeof experimentUploadsContract &
  typeof experimentDataAnnotationsContract &
  typeof experimentLocationsContract &
  typeof experimentLayoutContract &
  typeof experimentContributorsContract &
  typeof experimentDevicesContract &
  typeof experimentMetadataContract &
  typeof experimentFlowsContract &
  typeof experimentWorkbooksContract &
  typeof experimentDashboardsContract &
  typeof experimentVisualizationsContract &
  typeof experimentJoinRequestsContract &
  typeof experimentJoinCodesContract &
  typeof experimentTransferRequestsContract &
  typeof experimentProjectTransferWebhookContract &
  typeof experimentUploadWebhookContract &
  typeof experimentColumnsContract &
  typeof experimentStandardsContract &
  typeof experimentSessionsContract &
  typeof experimentStudyContract;
const experiments: ExperimentsContract = {
  ...experimentContract,
  ...experimentDataContract,
  ...experimentExportsContract,
  ...experimentUploadsContract,
  ...experimentDataAnnotationsContract,
  ...experimentLocationsContract,
  ...experimentLayoutContract,
  ...experimentContributorsContract,
  ...experimentDevicesContract,
  ...experimentMetadataContract,
  ...experimentFlowsContract,
  ...experimentWorkbooksContract,
  ...experimentDashboardsContract,
  ...experimentVisualizationsContract,
  ...experimentJoinRequestsContract,
  ...experimentJoinCodesContract,
  ...experimentTransferRequestsContract,
  ...experimentProjectTransferWebhookContract,
  ...experimentUploadWebhookContract,
  ...experimentColumnsContract,
  ...experimentStandardsContract,
  ...experimentSessionsContract,
  ...experimentStudyContract,
};

export type IotContract = typeof iotContract &
  typeof iotDeviceGroupContract &
  typeof iotFirmwareContract &
  typeof iotCalibrationContract;
const iot: IotContract = {
  ...iotContract,
  ...iotDeviceGroupContract,
  ...iotFirmwareContract,
  ...iotCalibrationContract,
};

export type OrganizationsContract = typeof organizationContract &
  typeof organizationJoinRequestsContract;
const organizations: OrganizationsContract = {
  ...organizationContract,
  ...organizationJoinRequestsContract,
};

export type SharingContract = typeof sharingContract &
  typeof sharingTransferAdminContract &
  typeof sharingTransferOrgContract;
const sharing: SharingContract = {
  ...sharingContract,
  ...sharingTransferAdminContract,
  ...sharingTransferOrgContract,
};

// Aggregate oRPC contract router mirroring the ts-rest `contract` shape so the
// frontend clients call `orpc.<domain>.<endpoint>` exactly as they did with
// ts-rest. Each domain is flat; the experiment domain merges its sub-contracts.
// `uploadData` is intentionally absent (it is a native streaming endpoint).
export const contract = {
  experiments,
  datasets: datasetContract,
  health: healthContract,
  iot,
  macros: macroContract,
  metrics: metricsContract,
  newsletter: newsletterContract,
  notifications: notificationContract,
  organizations,
  protocols: protocolContract,
  search: searchContract,
  sharing,
  users: userContract,
  visits: visitContract,
  workbooks: workbookContract,
};
