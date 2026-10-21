import type { DbOrTx } from "@repo/database";

export type GuestResourceKind = "experiment" | "macro" | "protocol" | "workbook" | "organization";
export interface GuestResourceOwnership {
  organizationId: string | null;
  organizationType: string | null;
  visibility: "public" | "private";
}
export const GUEST_RESOURCE_PORT = Symbol("GUEST_RESOURCE_PORT");
export interface GuestResourcePort {
  findOwnership(
    kind: GuestResourceKind,
    id: string,
    executor?: DbOrTx,
  ): Promise<GuestResourceOwnership | null>;
}
