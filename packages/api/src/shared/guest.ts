import { z } from "zod";

export const GUEST_EMAIL_DOMAIN = "guest.openjii.invalid";
export const GUEST_UPLOAD_MAX_BYTES = 1_048_576;
export const GUEST_HOURLY_LIMIT = 60;
export const GUEST_ORGANIZATION_HOURLY_LIMIT = 1200;

const webAddress = /(?:[a-z][a-z\d+.-]*:\/\/|\bwww\.|\b(?:[\p{L}\d-]+\.)+[\p{L}]{2,}(?:\b|\/))/iu;

export const zGuestName = z
  .string()
  .trim()
  .max(60)
  .refine((name) => !name.includes("@"), "Names cannot contain an email address")
  .refine((name) => !webAddress.test(name), "Names cannot contain a web address")
  .transform((name) => name || "Guest");

export function isGuestEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}
