import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zAddCompatibleMacrosBody,
  zCreateProtocolRequestBody,
  zProtocol,
  zProtocolFilterQuery,
  zProtocolIdPathParam,
  zProtocolList,
  zProtocolMacroList,
  zProtocolMacroPathParams,
  zUpdateProtocolRequestBody,
} from "./protocol.schema";

export const protocolOrpcContract = {
  listProtocols: oc
    .route({ method: "GET", path: "/api/v1/protocols", successStatus: 200 })
    .input(zProtocolFilterQuery)
    .output(zProtocolList),
  getProtocol: oc
    .route({ method: "GET", path: "/api/v1/protocols/{id}", successStatus: 200 })
    .input(zProtocolIdPathParam)
    .output(zProtocol),
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
