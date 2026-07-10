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

export const zProvisionDeviceRequest = z.object({
  serialNumber: z.string().min(1),
  deviceClass: z.string().min(1),
});

export const zProvisionDeviceResponse = z.object({
  thingName: z.string(),
  certificateId: z.string(),
  certificateArn: z.string(),
  certificatePem: z.string(),
  privateKey: z.string(),
});

export const zRotateCertificateResponse = z.object({
  certificateId: z.string(),
  certificateArn: z.string(),
  certificatePem: z.string(),
});

export type IotDevice = z.infer<typeof zIotDevice>;
export type ProvisionDeviceRequest = z.infer<typeof zProvisionDeviceRequest>;
export type ProvisionDeviceResponse = z.infer<typeof zProvisionDeviceResponse>;
export type RotateCertificateResponse = z.infer<typeof zRotateCertificateResponse>;
