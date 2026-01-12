import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

// Auth schemas
export const zSignInEmailBody = z.object({
  email: z.string().email(),
});

export const zSignInEmailResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const zVerifyEmailBody = z.object({
  email: z.string().email(),
  code: z.string(),
});

export const zVerifyEmailResponse = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    registered: z.boolean(),
    emailVerified: z.boolean(),
  }),
  session: z.object({
    token: z.string(),
    expiresAt: z.string(),
  }),
});

export const zSessionResponse = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    registered: z.boolean(),
    emailVerified: z.boolean(),
  }),
  session: z.object({
    token: z.string(),
    expiresAt: z.string(),
  }),
});

export const zSignOutResponse = z.object({
  success: z.boolean(),
});

export const zUpdateUserBody = z.object({
  registered: z.boolean().optional(),
  name: z.string().optional(),
  image: z.string().optional(),
});

export const zUpdateUserResponse = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    registered: z.boolean(),
    emailVerified: z.boolean(),
  }),
});

export const zErrorResponse = z.object({
  error: z.string(),
  message: z.string().optional(),
});

// Auth contract
export const authContract = c.router({
  // Email OTP sign-in (sends OTP to email)
  signInEmail: {
    method: "POST",
    path: "/api/v1/auth/signin/email",
    body: zSignInEmailBody,
    responses: {
      200: zSignInEmailResponse,
      400: zErrorResponse,
    },
    summary: "Send sign-in OTP to email",
    description: "Sends a one-time password to the provided email address",
  },

  // Verify email OTP and sign in
  verifyEmail: {
    method: "POST",
    path: "/api/v1/auth/verify/email",
    body: zVerifyEmailBody,
    responses: {
      200: zVerifyEmailResponse,
      400: zErrorResponse,
      401: zErrorResponse,
    },
    summary: "Verify email OTP",
    description: "Verifies the OTP and creates a session",
  },

  // Get current session
  getSession: {
    method: "GET",
    path: "/api/v1/auth/session",
    responses: {
      200: zSessionResponse,
      401: zErrorResponse,
    },
    summary: "Get current session",
    description: "Returns the current user session if authenticated",
  },

  // Sign out
  signOut: {
    method: "POST",
    path: "/api/v1/auth/signout",
    body: z.object({}),
    responses: {
      200: zSignOutResponse,
    },
    summary: "Sign out",
    description: "Ends the current user session",
  },

  // Update user (e.g., mark as registered)
  updateUser: {
    method: "PATCH",
    path: "/api/v1/auth/user",
    body: zUpdateUserBody,
    responses: {
      200: zUpdateUserResponse,
      400: zErrorResponse,
      401: zErrorResponse,
    },
    summary: "Update current user",
    description: "Updates the current authenticated user's information",
  },

  // OAuth callback (handled by Better Auth, but exposed for documentation)
  oauthCallback: {
    method: "GET",
    path: "/api/v1/auth/callback/:provider",
    pathParams: z.object({
      provider: z.enum(["github", "orcid"]),
    }),
    responses: {
      302: z.undefined(), // Redirect
    },
    summary: "OAuth callback",
    description: "Handles OAuth provider callbacks (redirects)",
  },
});
