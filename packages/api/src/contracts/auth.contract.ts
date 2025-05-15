import { initContract } from "@ts-rest/core";
import z from "zod";

import {
  zCsrfAuthSchema,
  zHtmlAuthSchema,
  zProvidersAuthSchema,
  zSessionAuthSchema,
  zUrlAuthSchema,
} from "../schemas/auth.schema";
import { zErrorResponse } from "../schemas/experiment.schema";

const c = initContract();

export const authContract = c.router({
  // Invalidate session (requires CSRF token)
  signOut: {
    method: "POST",
    path: "/api/v1/auth/signout",
    body: z.object({
      callbackUrl: z.string().optional(),
    }),
    responses: {
      200: z.object({}),
      302: zUrlAuthSchema,
      400: zErrorResponse,
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
