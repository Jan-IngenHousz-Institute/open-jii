import { z } from "zod";

export const zIotDevice = z.object({
  id: z.string().uuid(),
  thingName: z.string(),
  serialNumber: z.string(),
  deviceClass: z.string(),
  certificateId: z.string(),
  certificateArn: z.string(),
  status: z.enum(["active", "rotating", "revoked"]),
  ownerUserId: z.string().uuid().nullable(),
  provisionedAt: z.string().datetime(),
  rotatedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zValidateProvisioningRequest = z.object({
  serialNumber: z.string().min(1),
  deviceClass: z.string().min(1),
  certificateId: z.string().min(1),
});

export const zValidateProvisioningResponse = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
});

export const zRotateCertificateResponse = z.object({
  certificateId: z.string(),
  certificateArn: z.string(),
  certificatePem: z.string(),
});

export type IotDevice = z.infer<typeof zIotDevice>;
export type ValidateProvisioningRequest = z.infer<typeof zValidateProvisioningRequest>;
export type ValidateProvisioningResponse = z.infer<typeof zValidateProvisioningResponse>;
export type RotateCertificateResponse = z.infer<typeof zRotateCertificateResponse>;
