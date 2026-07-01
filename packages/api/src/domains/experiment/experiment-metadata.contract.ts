import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zCreateExperimentMetadataBody,
  zExperimentIdPathParam,
  zExperimentMetadata,
  zExperimentMetadataPathParam,
  zUpdateExperimentMetadataBody,
} from "./experiment.schema";

export const experimentMetadataContract = {
  listExperimentMetadata: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/metadata", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(z.array(zExperimentMetadata)),
  createExperimentMetadata: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/metadata", successStatus: 201 })
    .input(zExperimentIdPathParam.merge(zCreateExperimentMetadataBody))
    .output(zExperimentMetadata),
  updateExperimentMetadata: oc
    .route({
      method: "PUT",
      path: "/api/v1/experiments/{id}/metadata/{metadataId}",
      successStatus: 200,
    })
    .input(zExperimentMetadataPathParam.merge(zUpdateExperimentMetadataBody))
    .output(zExperimentMetadata),
  deleteExperimentMetadata: oc
    .route({
      method: "DELETE",
      path: "/api/v1/experiments/{id}/metadata/{metadataId}",
      successStatus: 204,
    })
    .input(zExperimentMetadataPathParam)
    .output(z.void()),
};
