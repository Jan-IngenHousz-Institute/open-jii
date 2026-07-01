import { oc } from "@orpc/contract";

import {
  zExperimentAddAnnotationBody,
  zExperimentAddAnnotationsBulkBody,
  zExperimentAnnotationDeleteBulkBody,
  zExperimentAnnotationDeleteBulkPathParam,
  zExperimentAnnotationPathParam,
  zExperimentAnnotationRowsAffected,
  zExperimentIdPathParam,
  zExperimentUpdateAnnotationBody,
} from "../experiment.schema";

export const experimentDataAnnotationsContract = {
  addAnnotation: oc
    .route({
      method: "POST",
      path: "/api/v1/experiments/{id}/data/annotations",
      successStatus: 201,
    })
    .input(zExperimentIdPathParam.and(zExperimentAddAnnotationBody))
    .output(zExperimentAnnotationRowsAffected),
  addAnnotationsBulk: oc
    .route({
      method: "POST",
      path: "/api/v1/experiments/{id}/data/annotations/bulk",
      successStatus: 201,
    })
    .input(zExperimentIdPathParam.and(zExperimentAddAnnotationsBulkBody))
    .output(zExperimentAnnotationRowsAffected),
  updateAnnotation: oc
    .route({
      method: "PATCH",
      path: "/api/v1/experiments/{id}/data/annotations/{annotationId}",
      successStatus: 200,
    })
    .input(zExperimentAnnotationPathParam.and(zExperimentUpdateAnnotationBody))
    .output(zExperimentAnnotationRowsAffected),
  deleteAnnotation: oc
    .route({
      method: "DELETE",
      path: "/api/v1/experiments/{id}/data/annotations/{annotationId}",
      successStatus: 200,
    })
    .input(zExperimentAnnotationPathParam)
    .output(zExperimentAnnotationRowsAffected),
  deleteAnnotationsBulk: oc
    .route({
      method: "POST",
      path: "/api/v1/experiments/{id}/data/annotations/bulk-delete",
      successStatus: 200,
    })
    .input(zExperimentAnnotationDeleteBulkPathParam.and(zExperimentAnnotationDeleteBulkBody))
    .output(zExperimentAnnotationRowsAffected),
};
