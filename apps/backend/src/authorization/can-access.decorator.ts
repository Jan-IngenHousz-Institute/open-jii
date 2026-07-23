import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import { CAN_ACCESS_KEY, CanAccessGuard } from "./can-access.guard";
import type { CanAccessMetadata } from "./can-access.guard";

/**
 * Declare the authorization requirement for a route and attach the guard that
 * enforces it. The guarded resource id is read from `req.params[param]`
 * (default `id`). Use on any route whose path carries the resource id:
 *
 * ```ts
 * @CanAccess({ resource: "macro", action: "update" })
 * @Implement(macroContract.updateMacro)
 * updateMacro() { ... }  // handler stays pure business logic
 * ```
 *
 * Routes whose path id is not the authorized resource (e.g. a sub-resource id)
 * should call `AuthorizationService.can()` inside the use-case instead.
 */
export function CanAccess(meta: CanAccessMetadata) {
  return applyDecorators(SetMetadata(CAN_ACCESS_KEY, meta), UseGuards(CanAccessGuard));
}
