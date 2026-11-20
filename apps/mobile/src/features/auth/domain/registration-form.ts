import { z } from "zod";

export interface RegistrationFormValues {
  email: string;
  firstName: string;
  lastName: string;
  acceptedTerms: boolean;
  newsletterOptIn: boolean;
}

export type RegistrationFieldError = "email" | "firstName" | "lastName" | "acceptedTerms";

// Mirrors the backend's createUserProfile body, which rejects names shorter than two characters.
const MIN_NAME_LENGTH = 2;

export function isValidEmail(email: string | null | undefined): boolean {
  return z.string().email().safeParse(email).success;
}

export function validateRegistration(
  values: RegistrationFormValues,
  { needsEmail }: { needsEmail: boolean },
): RegistrationFieldError[] {
  const errors: RegistrationFieldError[] = [];
  if (needsEmail && !isValidEmail(values.email.trim())) errors.push("email");
  if (values.firstName.trim().length < MIN_NAME_LENGTH) errors.push("firstName");
  if (values.lastName.trim().length < MIN_NAME_LENGTH) errors.push("lastName");
  if (!values.acceptedTerms) errors.push("acceptedTerms");
  return errors;
}
