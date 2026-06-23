import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zAddCompatibleProtocolsBody,
  zCreateMacroRequestBody,
  zMacro,
  zMacroBatchExecutionRequestBody,
  zMacroBatchExecutionResponse,
  zMacroExecutionRequestBody,
  zMacroExecutionResponse,
  zMacroFilterQuery,
  zMacroIdPathParam,
  zMacroList,
  zMacroProtocolList,
  zMacroProtocolPathParams,
  zUpdateMacroRequestBody,
} from "./macro.schema";

export const macroOrpcContract = {
  listMacros: oc
    .route({ method: "GET", path: "/api/v1/macros", successStatus: 200 })
    .input(zMacroFilterQuery)
    .output(zMacroList),
  getMacro: oc
    .route({ method: "GET", path: "/api/v1/macros/{id}", successStatus: 200 })
    .input(zMacroIdPathParam)
    .output(zMacro),
  createMacro: oc
    .route({ method: "POST", path: "/api/v1/macros", successStatus: 201 })
    .input(zCreateMacroRequestBody)
    .output(zMacro),
  updateMacro: oc
    .route({ method: "PUT", path: "/api/v1/macros/{id}", successStatus: 200 })
    .input(zMacroIdPathParam.merge(zUpdateMacroRequestBody))
    .output(zMacro),
  deleteMacro: oc
    .route({ method: "DELETE", path: "/api/v1/macros/{id}", successStatus: 204 })
    .input(zMacroIdPathParam)
    .output(z.void()),
  listCompatibleProtocols: oc
    .route({ method: "GET", path: "/api/v1/macros/{id}/protocols", successStatus: 200 })
    .input(zMacroIdPathParam)
    .output(zMacroProtocolList),
  addCompatibleProtocols: oc
    .route({ method: "POST", path: "/api/v1/macros/{id}/protocols", successStatus: 201 })
    .input(zMacroIdPathParam.merge(zAddCompatibleProtocolsBody))
    .output(zMacroProtocolList),
  removeCompatibleProtocol: oc
    .route({ method: "DELETE", path: "/api/v1/macros/{id}/protocols/{protocolId}", successStatus: 204 })
    .input(zMacroProtocolPathParams)
    .output(z.void()),
  executeMacro: oc
    .route({ method: "POST", path: "/api/v1/macros/{id}/execute", successStatus: 200 })
    .input(zMacroIdPathParam.merge(zMacroExecutionRequestBody))
    .output(zMacroExecutionResponse),
  executeMacroBatch: oc
    .route({ method: "POST", path: "/api/v1/macros/execute-batch", successStatus: 200 })
    .input(zMacroBatchExecutionRequestBody)
    .output(zMacroBatchExecutionResponse),
};
