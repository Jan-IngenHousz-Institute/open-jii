import { z } from "zod";

import { zExperimentMembershipStatus, zExperimentStatus } from "../experiment.schema";

/**
 * 31 glyphs. `0`, `O`, `1`, `I` and `L` are left out: the code is read off a
 * projector and typed on a phone, so the pairs that look alike must not exist.
 */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const JOIN_CODE_LENGTH = 8;

/** Uppercase, dropping whitespace and hyphens. Shared by both clients and the server. */
export function normalizeJoinCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** `ABCDEFGH` → `ABCD-EFGH` for display. Anything else is returned untouched. */
export function formatJoinCode(code: string): string {
  const normalized = normalizeJoinCode(code);
  if (normalized.length !== JOIN_CODE_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, JOIN_CODE_LENGTH / 2)}-${normalized.slice(JOIN_CODE_LENGTH / 2)}`;
}

/**
 * Normalization happens before validation, so `abcd-efgh`, `ABCD EFGH` and
 * `ABCDEFGH` are one code on every client and on the server.
 */
export const zJoinCodeValue = z
  .string()
  .transform(normalizeJoinCode)
  .pipe(
    z
      .string()
      .regex(new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`), "Invalid join code"),
  );

export const zJoinCodePathParam = z.object({
  code: zJoinCodeValue.describe("The join code, with or without its display hyphen"),
});

export const zJoinCodeExpiry = z.enum(["1d", "7d", "30d", "never"]);

export const zExperimentJoinCode = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  /** Normalized, without the display hyphen; clients call {@link formatJoinCode}. */
  code: z.string(),
  expiresAt: z.string().datetime().nullable(),
  redemptionCount: z.number().int(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable(),
});

export const zExperimentJoinCodeResponse = z.object({
  joinCode: zExperimentJoinCode.nullable(),
});

export const zCreateJoinCodeBody = z.object({
  expiresIn: zJoinCodeExpiry.default("7d").describe("How long the new code stays valid"),
});

export const zJoinCodePreview = z.object({
  experiment: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    organizationName: z.string().nullish(),
    status: zExperimentStatus,
    /** The measurement flow needs a pinned workbook version; without one it cannot start. */
    hasWorkbook: z.boolean(),
  }),
  membershipStatus: zExperimentMembershipStatus,
  expiresAt: z.string().datetime().nullable(),
});

export const zRedeemJoinCodeResponse = z.object({
  experimentId: z.string().uuid(),
  outcome: z.enum(["joined", "already_member"]),
});

export type JoinCodeExpiry = z.infer<typeof zJoinCodeExpiry>;
export type ExperimentJoinCode = z.infer<typeof zExperimentJoinCode>;
export type ExperimentJoinCodeResponse = z.infer<typeof zExperimentJoinCodeResponse>;
export type CreateJoinCodeBody = z.infer<typeof zCreateJoinCodeBody>;
export type JoinCodePathParam = z.infer<typeof zJoinCodePathParam>;
export type JoinCodePreview = z.infer<typeof zJoinCodePreview>;
export type RedeemJoinCodeResponse = z.infer<typeof zRedeemJoinCodeResponse>;
