import type { Transaction } from "@repo/database";

import type { AdmitMemberInput, AdmitMemberOutcome } from "../models/organization-member.model";

export const MEMBER_ADMISSION_PORT = Symbol("MEMBER_ADMISSION_PORT");

export interface MemberAdmissionPort {
  admit(tx: Transaction, input: AdmitMemberInput): Promise<AdmitMemberOutcome>;
}
