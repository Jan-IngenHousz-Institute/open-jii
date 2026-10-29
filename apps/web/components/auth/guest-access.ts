// Whether a guest may call the procedure behind each action the UI offers. The answers mirror
// the backend's guest-routes.json, which guest-access.test.ts checks. Creating an organization
// goes through Better Auth, whose organization plugin refuses guests.
const GUEST_ACCESS = {
  "experiments.createExperiment": false,
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
