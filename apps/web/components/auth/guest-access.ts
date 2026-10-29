// Whether a guest may call the procedure behind each action or view the UI offers. The answers
// mirror backend route metadata and inventories, which guest-access.test.ts checks. Creating an
// organization goes through Better Auth, whose organization plugin refuses guests.
const GUEST_ACCESS = {
  "experiments.createExperiment": false,
  "experiments.listExperimentDevices": false,
  "experiments.addAnnotation": false,
  "experiments.initiateExport": false,
  "ExperimentDataUploadsController.uploadData": false,
  "sharing.listGrants": false,
  "metrics.getResourceMetrics": false,
  "metrics.getScopedMetrics": false,
  "notifications.listNotifications": false,
  "notifications.getUnreadNotificationCount": false,
  "organizations.listOrganizationMembers": false,
  "organizations.listOrganizationTeams": false,
  "search.globalSearch": false,
  "users.getUserProfile": false,
  "users.getWhatsNewSeen": false,
  "users.createUserProfile": false,
  "newsletter.subscribe": false,
  "experiments.createTransferRequest": false,
  "protocols.createProtocol": false,
  "macros.createMacro": false,
  "workbooks.createWorkbook": false,
  "iot.listIotDevices": false,
  "iot.registerIotDevice": false,
  "iot.bulkRegisterIotDevices": false,
  "iot.listCalibrationDefinitions": false,
  "iot.createCalibrationDefinition": false,
  "organizations.createOrganizationJoinRequest": false,
  "organization.create": false,
} as const satisfies Record<string, boolean>;

export type GuestGatedProcedure = keyof typeof GUEST_ACCESS;

export const guestGatedProcedures = Object.keys(GUEST_ACCESS) as GuestGatedProcedure[];

export function guestMayUse(procedure: GuestGatedProcedure | undefined, isGuest: boolean) {
  return !isGuest || procedure === undefined || GUEST_ACCESS[procedure];
}
