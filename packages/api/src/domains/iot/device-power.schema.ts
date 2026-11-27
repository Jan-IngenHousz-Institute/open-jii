import { z } from "zod";

export const zDevicePowerProtection = z.object({
  state: z.string().nullable(),
  reason: z.string().nullable(),
  sinceUtc: z.number().int().nonnegative().nullable(),
  skipped: z.object({
    flashRuns: z.number().int().nonnegative().nullable(),
    ambitRuns: z.number().int().nonnegative().nullable(),
    ota: z.number().int().nonnegative().nullable(),
  }),
});

export const zDevicePowerReading = z.object({
  capturedAt: z.string().datetime(),
  valid: z.boolean().nullable(),
  reason: z.string().nullable(),
  batteryV: z.number().nullable(),
  systemV: z.number().nullable(),
  chargeStatus: z.number().int().nullable(),
  chargeMa: z.number().nullable(),
  protection: zDevicePowerProtection.nullable(),
});

export const zDevicePower = z.object({
  latest: zDevicePowerReading.nullable(),
  // Only within the selected range. Firmware validity does not prove ADC freshness.
  lastValidBattery: z
    .object({ capturedAt: z.string().datetime(), batteryV: z.number().positive() })
    .nullable(),
});

export type DevicePower = z.infer<typeof zDevicePower>;
export type DevicePowerReading = z.infer<typeof zDevicePowerReading>;
