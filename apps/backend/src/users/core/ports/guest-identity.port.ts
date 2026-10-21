import type { DbOrTx } from "@repo/database";

import type { GuestIdentity, GuestQuotaDecision, GuestQuotaKind } from "../models/guest.model";

export const GUEST_IDENTITY_PORT = Symbol("GUEST_IDENTITY_PORT");

export interface GuestIdentityPort {
  findIdentity(userId: string, executor?: DbOrTx): Promise<GuestIdentity | null>;
  hasSession(userId: string, token: string): Promise<boolean>;
  takeQuota(userId: string, kind: GuestQuotaKind, now?: Date): Promise<GuestQuotaDecision>;
}
