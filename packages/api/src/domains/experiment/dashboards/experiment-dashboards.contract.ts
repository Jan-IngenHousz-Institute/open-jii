import { oc } from "@orpc/contract";
import { z } from "zod";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zCreateExperimentDashboardBody,
  zCreateExperimentDashboardResponse,
  zExperimentDashboard,
  zExperimentDashboardList,
  zExperimentDashboardPathParam,
  zListExperimentDashboardsQuery,
  zUpdateExperimentDashboardBody,
  zUpdateExperimentDashboardResponse,
} from "./experiment-dashboards.schema";

export const experimentDashboardsContract = {
  listExperimentDashboards: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/dashboards", successStatus: 200 })
    .input(zExperimentIdPathParam.merge(zListExperimentDashboardsQuery))
    .output(zExperimentDashboardList),
  createExperimentDashboard: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/dashboards", successStatus: 201 })
    .input(zExperimentIdPathParam.merge(zCreateExperimentDashboardBody))
    .output(zCreateExperimentDashboardResponse),
  getExperimentDashboard: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/dashboards/{dashboardId}",
      successStatus: 200,
    })
    .input(zExperimentDashboardPathParam)
    .output(zExperimentDashboard),
  updateExperimentDashboard: oc
    .route({
      method: "PATCH",
      path: "/api/v1/experiments/{id}/dashboards/{dashboardId}",
      successStatus: 200,
    })
    .input(zExperimentDashboardPathParam.merge(zUpdateExperimentDashboardBody))
    .output(zUpdateExperimentDashboardResponse),
  deleteExperimentDashboard: oc
    .route({
      method: "DELETE",
      path: "/api/v1/experiments/{id}/dashboards/{dashboardId}",
      successStatus: 204,
    })
    .input(zExperimentDashboardPathParam)
    .output(z.void()),
};
