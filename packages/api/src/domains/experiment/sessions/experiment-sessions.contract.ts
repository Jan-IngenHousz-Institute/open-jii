import { oc } from "@orpc/contract";
import { z } from "zod";

import { zExperimentIdPathParam } from "../experiment.schema";
import {
  zEndedSession,
  zEndedSessionsQuery,
  zFieldAssignments,
  zMeasuredTwicePlot,
  zMeasurer,
  zSessionDays,
  zSessionProgress,
  zWalkingOrder,
} from "./experiment-sessions.schema";

export const experimentSessionsContract = {
  getExperimentWalkingOrder: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/walking-order", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zWalkingOrder),
  listExperimentMeasurers: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/measurers", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(z.array(zMeasurer)),
  getExperimentFieldAssignments: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/assignments", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zFieldAssignments.nullable()),
  getExperimentSessionProgress: oc
    .route({
      method: "GET",
      path: "/api/v1/experiments/{id}/sessions/progress",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam)
    .output(zSessionProgress.nullable()),
  listExperimentSessionDays: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/sessions/days", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zSessionDays),
  listExperimentEndedSessions: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/sessions/ended", successStatus: 200 })
    .input(zExperimentIdPathParam.and(zEndedSessionsQuery))
    .output(z.array(zEndedSession)),
  listExperimentMeasuredTwice: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/measured-twice", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(z.array(zMeasuredTwicePlot)),
};
