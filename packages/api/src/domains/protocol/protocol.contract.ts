import { oc } from "@orpc/contract";
import { z } from "zod";

import { zSetVisibilityBody, zSetVisibilityResponse } from "../visibility/visibility.schema";
import {
  zAddCompatibleMacrosBody,
  zCreateProtocolRequestBody,
  zProtocol,
  zProtocolDetail,
  zProtocolFilterQuery,
  zProtocolIdPathParam,
  zProtocolList,
  zProtocolMacroList,
  zProtocolPaginatedList,
  zProtocolPaginatedQuery,
  zProtocolMacroPathParams,
  zUpdateProtocolRequestBody,
} from "./protocol.schema";

export const protocolContract = {
  listProtocols: oc
    .route({ method: "GET", path: "/api/v1/protocols", successStatus: 200 })
    .input(zProtocolFilterQuery)
    .output(zProtocolList),
  listProtocolsPaginated: oc
    .route({ method: "GET", path: "/api/v1/protocols/paginated", successStatus: 200 })
    .input(zProtocolPaginatedQuery)
    .output(zProtocolPaginatedList),
  getProtocol: oc
    .route({ method: "GET", path: "/api/v1/protocols/{id}", successStatus: 200 })
    .input(zProtocolIdPathParam)
    .output(zProtocolDetail),
  createProtocol: oc
    .route({ method: "POST", path: "/api/v1/protocols", successStatus: 201 })
    .input(zCreateProtocolRequestBody)
    .output(zProtocol),
  updateProtocol: oc
    .route({ method: "PATCH", path: "/api/v1/protocols/{id}", successStatus: 200 })
    .input(zProtocolIdPathParam.merge(zUpdateProtocolRequestBody))
    .output(zProtocol),
  deleteProtocol: oc
    .route({ method: "DELETE", path: "/api/v1/protocols/{id}", successStatus: 204 })
    .input(zProtocolIdPathParam)
    .output(z.void()),
  // Publish (monotonic private→public, gated on `manage`).
  setVisibility: oc
    .route({ method: "PATCH", path: "/api/v1/protocols/{id}/visibility", successStatus: 200 })
    .input(zProtocolIdPathParam.merge(zSetVisibilityBody))
    .output(zSetVisibilityResponse),
  listCompatibleMacros: oc
    .route({ method: "GET", path: "/api/v1/protocols/{id}/macros", successStatus: 200 })
    .input(zProtocolIdPathParam)
    .output(zProtocolMacroList),
  addCompatibleMacros: oc
    .route({ method: "POST", path: "/api/v1/protocols/{id}/macros", successStatus: 201 })
    .input(zProtocolIdPathParam.merge(zAddCompatibleMacrosBody))
    .output(zProtocolMacroList),
  removeCompatibleMacro: oc
    .route({
      method: "DELETE",
      path: "/api/v1/protocols/{id}/macros/{macroId}",
      successStatus: 204,
    })
    .input(zProtocolMacroPathParams)
    .output(z.void()),
};
