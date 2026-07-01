import { oc } from "@orpc/contract";

import {
  zAddExperimentLocationsBody,
  zExperimentGeocodeQuery,
  zExperimentGeocodeResponse,
  zExperimentIdPathParam,
  zExperimentLocationList,
  zExperimentPlaceSearchQuery,
  zExperimentPlaceSearchResponse,
  zUpdateExperimentLocationsBody,
} from "./experiment.schema";

export const experimentLocationsContract = {
  getExperimentLocations: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/locations", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperimentLocationList),
  addExperimentLocations: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/locations", successStatus: 201 })
    .input(zExperimentIdPathParam.merge(zAddExperimentLocationsBody))
    .output(zExperimentLocationList),
  updateExperimentLocations: oc
    .route({ method: "PUT", path: "/api/v1/experiments/{id}/locations", successStatus: 200 })
    .input(zExperimentIdPathParam.merge(zUpdateExperimentLocationsBody))
    .output(zExperimentLocationList),
  searchPlaces: oc
    .route({ method: "GET", path: "/api/v1/locations/search", successStatus: 200 })
    .input(zExperimentPlaceSearchQuery)
    .output(zExperimentPlaceSearchResponse),
  geocodeLocation: oc
    .route({ method: "GET", path: "/api/v1/locations/geocode", successStatus: 200 })
    .input(zExperimentGeocodeQuery)
    .output(zExperimentGeocodeResponse),
};
