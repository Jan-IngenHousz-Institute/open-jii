import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zAddIotDeviceGroupMembersBody,
  zCreateIotDeviceGroupBody,
  zIotDeviceGroup,
  zIotDeviceGroupCredentialsBody,
  zIotDeviceGroupCredentialsResult,
  zIotDeviceGroupDetail,
  zIotDeviceGroupList,
  zIotDeviceGroupMemberList,
  zIotDeviceGroupOnboardResult,
  zIotDeviceGroupMonitoring,
  zIotDeviceGroupMonitoringQuery,
  zIotDeviceGroupPathParam,
  zIotDeviceGroupRevokeResult,
  zOnboardIotDeviceGroupBody,
  zRemoveIotDeviceGroupMemberParams,
  zUpdateIotDeviceGroupBody,
} from "./iot-device-group.schema";

export const iotDeviceGroupContract = {
  listIotDeviceGroups: oc
    .route({ method: "GET", path: "/api/v1/device-groups", successStatus: 200 })
    .output(zIotDeviceGroupList),
  createIotDeviceGroup: oc
    .route({ method: "POST", path: "/api/v1/device-groups", successStatus: 201 })
    .input(zCreateIotDeviceGroupBody)
    .output(zIotDeviceGroup),
  getIotDeviceGroup: oc
    .route({ method: "GET", path: "/api/v1/device-groups/{groupId}", successStatus: 200 })
    .input(zIotDeviceGroupPathParam)
    .output(zIotDeviceGroupDetail),
  updateIotDeviceGroup: oc
    .route({ method: "PATCH", path: "/api/v1/device-groups/{groupId}", successStatus: 200 })
    .input(zIotDeviceGroupPathParam.merge(zUpdateIotDeviceGroupBody))
    .output(zIotDeviceGroup),
  deleteIotDeviceGroup: oc
    .route({ method: "DELETE", path: "/api/v1/device-groups/{groupId}", successStatus: 204 })
    .input(zIotDeviceGroupPathParam)
    .output(z.void()),
  onboardIotDeviceGroup: oc
    .route({
      method: "POST",
      path: "/api/v1/device-groups/{groupId}/onboard",
      successStatus: 200,
    })
    .input(zOnboardIotDeviceGroupBody)
    .output(zIotDeviceGroupOnboardResult),
  issueIotDeviceGroupCredentials: oc
    .route({
      method: "POST",
      path: "/api/v1/device-groups/{groupId}/credentials",
      successStatus: 200,
    })
    .input(zIotDeviceGroupCredentialsBody)
    .output(zIotDeviceGroupCredentialsResult),
  rotateIotDeviceGroupCredentials: oc
    .route({
      method: "POST",
      path: "/api/v1/device-groups/{groupId}/credentials/rotate",
      successStatus: 200,
    })
    .input(zIotDeviceGroupCredentialsBody)
    .output(zIotDeviceGroupCredentialsResult),
  // POST, not DELETE: the selection travels in the body, and DELETE bodies
  // are dropped by enough intermediaries to be untrustworthy.
  revokeIotDeviceGroupCredentials: oc
    .route({
      method: "POST",
      path: "/api/v1/device-groups/{groupId}/credentials/revoke",
      successStatus: 200,
    })
    .input(zIotDeviceGroupCredentialsBody)
    .output(zIotDeviceGroupRevokeResult),
  getIotDeviceGroupMonitoring: oc
    .route({
      method: "GET",
      path: "/api/v1/device-groups/{groupId}/monitoring",
      successStatus: 200,
    })
    .input(zIotDeviceGroupMonitoringQuery)
    .output(zIotDeviceGroupMonitoring),
  listIotDeviceGroupMembers: oc
    .route({ method: "GET", path: "/api/v1/device-groups/{groupId}/devices", successStatus: 200 })
    .input(zIotDeviceGroupPathParam)
    .output(zIotDeviceGroupMemberList),
  addIotDeviceGroupMembers: oc
    .route({ method: "POST", path: "/api/v1/device-groups/{groupId}/devices", successStatus: 200 })
    .input(zAddIotDeviceGroupMembersBody)
    .output(zIotDeviceGroupMemberList),
  removeIotDeviceGroupMember: oc
    .route({
      method: "DELETE",
      path: "/api/v1/device-groups/{groupId}/devices/{deviceId}",
      successStatus: 204,
    })
    .input(zRemoveIotDeviceGroupMemberParams)
    .output(z.void()),
};
