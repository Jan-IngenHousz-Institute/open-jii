import { describe, expect, it } from "vitest";
import type { RegistrationFormValues } from "~/features/auth/domain/registration-form";
import { isValidEmail, validateRegistration } from "~/features/auth/domain/registration-form";

const valid: RegistrationFormValues = {
  email: "",
  firstName: "Ada",
  lastName: "Lovelace",
  acceptedTerms: true,
  newsletterOptIn: false,
};

describe("validateRegistration", () => {
  it("accepts a complete form without asking for an email the account already has", () => {
    expect(validateRegistration(valid, { needsEmail: false })).toEqual([]);
  });

  it("flags every missing field at once", () => {
    const empty = { ...valid, firstName: "", lastName: "", acceptedTerms: false };
    expect(validateRegistration(empty, { needsEmail: true })).toEqual([
      "email",
      "firstName",
      "lastName",
      "acceptedTerms",
    ]);
  });

  it("does not count surrounding whitespace toward the two-character minimum", () => {
    const padded = { ...valid, firstName: " A ", lastName: "  " };
    expect(validateRegistration(padded, { needsEmail: false })).toEqual(["firstName", "lastName"]);
  });

  it("requires a real email only when the account lacks one", () => {
    expect(validateRegistration({ ...valid, email: "not-an-email" }, { needsEmail: true })).toEqual(
      ["email"],
    );
    expect(
      validateRegistration({ ...valid, email: " ada@example.com " }, { needsEmail: true }),
    ).toEqual([]);
  });
});

describe("isValidEmail", () => {
  it("treats an ORCID iD stored as the email as missing", () => {
    expect(isValidEmail("0000-0002-1825-0097")).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail("ada@example.com")).toBe(true);
  });
});
