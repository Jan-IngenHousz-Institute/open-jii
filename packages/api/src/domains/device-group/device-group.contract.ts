import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zAddDeviceGroupMembersBody,
  zCreateDeviceGroupBody,
  zDeviceGroup,
  zDeviceGroupDetail,
  zDeviceGroupList,
  zDeviceGroupMemberList,
  zDeviceGroupMonitoring,
  zDeviceGroupMonitoringQuery,
  zDeviceGroupPathParam,
  zRemoveDeviceGroupMemberParams,
  zUpdateDeviceGroupBody,
} from "./device-group.schema";

export const deviceGroupContract = {
  listDeviceGroups: oc
    .route({ method: "GET", path: "/api/v1/device-groups", successStatus: 200 })
    .output(zDeviceGroupList),
  createDeviceGroup: oc
    .route({ method: "POST", path: "/api/v1/device-groups", successStatus: 201 })
    .input(zCreateDeviceGroupBody)
    .output(zDeviceGroup),
  getDeviceGroup: oc
    .route({ method: "GET", path: "/api/v1/device-groups/{groupId}", successStatus: 200 })
    .input(zDeviceGroupPathParam)
    .output(zDeviceGroupDetail),
  updateDeviceGroup: oc
    .route({ method: "PATCH", path: "/api/v1/device-groups/{groupId}", successStatus: 200 })
    .input(zDeviceGroupPathParam.merge(zUpdateDeviceGroupBody))
    .output(zDeviceGroup),
  deleteDeviceGroup: oc
    .route({ method: "DELETE", path: "/api/v1/device-groups/{groupId}", successStatus: 204 })
    .input(zDeviceGroupPathParam)
    .output(z.void()),
  getDeviceGroupMonitoring: oc
    .route({
      method: "GET",
      path: "/api/v1/device-groups/{groupId}/monitoring",
      successStatus: 200,
    })
    .input(zDeviceGroupMonitoringQuery)
    .output(zDeviceGroupMonitoring),
  listDeviceGroupMembers: oc
    .route({ method: "GET", path: "/api/v1/device-groups/{groupId}/devices", successStatus: 200 })
    .input(zDeviceGroupPathParam)
    .output(zDeviceGroupMemberList),
  addDeviceGroupMembers: oc
    .route({ method: "POST", path: "/api/v1/device-groups/{groupId}/devices", successStatus: 200 })
    .input(zAddDeviceGroupMembersBody)
    .output(zDeviceGroupMemberList),
  removeDeviceGroupMember: oc
    .route({
      method: "DELETE",
      path: "/api/v1/device-groups/{groupId}/devices/{deviceId}",
      successStatus: 204,
    })
    .input(zRemoveDeviceGroupMemberParams)
    .output(z.void()),
};
