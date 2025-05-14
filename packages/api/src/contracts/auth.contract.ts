import { initContract } from "@ts-rest/core";
import z from "zod";

import {
  zCsrfAuthSchema,
  zHtmlAuthSchema,
  zProvidersAuthSchema,
  zSessionAuthSchema,
  zUrlAuthSchema,
} from "../schemas/auth.schema";

const c = initContract();

export const authContract = c.router({
  // Display built-in sign-in page
  signInPage: {
    method: "GET",
    path: "/api/v1/auth/signin",
    responses: {
      200: zHtmlAuthSchema,
    },
  },

  // Start provider-specific sign-in flow
  signIn: {
    method: "POST",
    path: "/api/v1/auth/signin",
    body: z.object({
      csrfToken: z.string(),
      callbackUrl: z.string().optional(),
      json: z.boolean().optional(),
    }),
    responses: {
      302: zUrlAuthSchema,
    },
  },

  // Handle OAuth callback (both GET and POST)
  callback: {
    method: "GET",
    path: "/api/v1/auth/callback/:provider",
    pathParams: z.object({ provider: z.string() }),
    responses: {
      307: zUrlAuthSchema,
    },
  },

  // Display built-in sign-out page
  signOutPage: {
    method: "GET",
    path: "/api/v1/auth/signout",
    responses: {
      200: zHtmlAuthSchema,
    },
  },

  // Invalidate session (requires CSRF token)
  signOut: {
    method: "POST",
    path: "/api/v1/auth/signout",
    body: z.object({ csrfToken: z.string() }),
    responses: {
      302: zUrlAuthSchema,
    },
  },

  // Return current session (or {} if none)
  session: {
    method: "GET",
    path: "/api/v1/auth/session",
    responses: {
      200: zSessionAuthSchema,
    },
  },

  // Return CSRF token
  csrf: {
    method: "GET",
    path: "/api/v1/auth/csrf",
    responses: {
      200: zCsrfAuthSchema,
    },
  },

  // List configured providers
  providers: {
    method: "GET",
    path: "/api/v1/auth/providers",
    responses: {
      200: zProvidersAuthSchema,
    },
  },

  // Error page
  error: {
    method: "GET",
    path: "/api/v1/auth/error",
    query: z.object({
      error: z.string(),
    }),
    responses: {
      200: zHtmlAuthSchema,
    },
  },
});
