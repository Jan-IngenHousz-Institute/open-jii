import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zAddExperimentMembersBody,
  zExperimentIdPathParam,
  zExperimentMember,
  zExperimentMemberList,
  zExperimentMemberPathParam,
  zTransferExperimentAdminBody,
  zTransferExperimentAdminResponse,
  zUpdateExperimentMemberRoleBody,
} from "./experiment.schema";

export const experimentMembersContract = {
  listExperimentMembers: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/members", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentMemberList),
  addExperimentMembers: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/members/batch", successStatus: 201 })
    .input(zExperimentIdPathParam.merge(zAddExperimentMembersBody))
    .output(zExperimentMemberList),
  removeExperimentMember: oc
    .route({
      method: "DELETE",
      path: "/api/v1/experiments/{id}/members/{memberId}",
      successStatus: 204,
    })
    .input(zExperimentMemberPathParam)
    .output(z.void()),
  updateExperimentMemberRole: oc
    .route({
      method: "PATCH",
      path: "/api/v1/experiments/{id}/members/{memberId}",
      successStatus: 200,
    })
    .input(zExperimentMemberPathParam.merge(zUpdateExperimentMemberRoleBody))
    .output(zExperimentMember),
  transferExperimentAdmin: oc
    .route({ method: "POST", path: "/api/v1/experiments/transfer-admin", successStatus: 200 })
    .input(zTransferExperimentAdminBody)
    .output(zTransferExperimentAdminResponse),
};
