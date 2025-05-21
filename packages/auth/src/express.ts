import {
  ExpressAuthConfig,
  getSession as getExpressSession,
} from "@auth/express";
import * as e from "express";
import { NextAuthConfig } from "next-auth";

import { adapter } from "./adapter";
import { authConfig } from "./config";

const config = {
  ...authConfig,
  adapter,
  session: { strategy: "jwt" },
} satisfies ExpressAuthConfig;

export const getSession = (request: e.Request) =>
  getExpressSession(request, config);

// import {
//   Auth,
//   type AuthConfig,
//   setEnvDefaults,
//   createActionURL,
// } from "@auth/core";
// import { skipCSRFCheck } from "@auth/core";
// import type { Session } from "@auth/core/types";
// import e from "express";

// import { adapter } from "./adapter";
// import { authConfig } from "./config";

// export type NestAuthConfig = Omit<AuthConfig, "raw">;

// const config = {
//   ...authConfig,
//   basePath: "/api/v1/auth",
//   session: { strategy: "jwt" },
//   callbacks: {
//     redirect({ url, baseUrl }) {
//       return url;
//     },
//   },
//   adapter,
//   skipCSRFCheck,
//   debug: true,
// } satisfies NestAuthConfig;

// /**
//  * Encodes an object as url-encoded string.
//  */
// export function encodeUrlEncoded(object: Record<string, any> = {}) {
//   const params = new URLSearchParams();

//   for (const [key, value] of Object.entries(object)) {
//     if (Array.isArray(value)) {
//       value.forEach((v) => params.append(key, v));
//     } else {
//       params.append(key, value);
//     }
//   }

//   return params.toString();
// }

// /**
//  * Encodes an object as JSON
//  */
// function encodeJson(obj: Record<string, any>) {
//   return JSON.stringify(obj);
// }

// /**
//  * Encodes an Express Request body based on the content type header.
//  */
// function encodeRequestBody(req: e.Request) {
//   const contentType = req.headers["content-type"];

//   if (contentType?.includes("application/x-www-form-urlencoded")) {
//     return encodeUrlEncoded(req.body);
//   }

//   if (contentType?.includes("application/json")) {
//     return encodeJson(req.body);
//   }

//   return req.body;
// }

// /**
//  * Adapts an Express Request to a Web Request, returning the Web Request.
//  */
// export function toWebRequest(req: e.Request) {
//   const url = req.protocol + "://" + req.get("host") + req.originalUrl;

//   const headers = new Headers();

//   Object.entries(req.headers).forEach(([key, value]) => {
//     if (Array.isArray(value)) {
//       value.forEach((v) => v && headers.append(key, v));
//       return;
//     }

//     if (value) {
//       headers.append(key, value);
//     }
//   });

//   // GET and HEAD not allowed to receive body
//   const body = /GET|HEAD/.test(req.method) ? undefined : encodeRequestBody(req);

//   const request = new Request(url, {
//     method: req.method,
//     headers,
//     body,
//   });

//   return request;
// }

// /**
//  * Adapts a Web Response to an Express Response, invoking appropriate
//  * Express response methods to handle the response.
//  */
// export async function toExpressResponse(response: Response, res: e.Response) {
//   response.headers.forEach((value, key) => {
//     if (value) {
//       res.append(key, value);
//     }
//   });

//   // Explicitly write the headers for content-type
//   // https://stackoverflow.com/a/59449326/13944042
//   res.writeHead(response.status, response.statusText, {
//     "Content-Type": response.headers.get("content-type") || "",
//   });

//   res.write(await response.text());
//   res.end();
// }

// export function NestAuth(config: NestAuthConfig) {
//   return async (req: e.Request, res: e.Response, next: e.NextFunction) => {
//     e.json()(req, res, async (err: any) => {
//       if (err) return next(err);
//       e.urlencoded({ extended: true })(req, res, async (err: any) => {
//         if (err) return next(err);
//         try {
//           setEnvDefaults(process.env, config);
//           await toExpressResponse(await Auth(toWebRequest(req), config), res);
//           if (!res.headersSent) next();
//         } catch (error) {
//           next(error);
//         }
//       });
//     });
//   };
// }

// export type GetSessionResult = Promise<Session | null>;

// export async function getSession(req: e.Request): GetSessionResult {
//   setEnvDefaults(process.env, config);
//   const url = createActionURL(
//     "session",
//     req.protocol,
//     // @ts-expect-error
//     new Headers(req.headers),
//     process.env,
//     config,
//   );

//   const response = await Auth(
//     new Request(url, { headers: { cookie: req.headers.cookie ?? "" } }),
//     config,
//   );

//   const { status = 200 } = response;

//   const data = await response.json();

//   if (!data || !Object.keys(data).length) return null;
//   if (status === 200) return data;
//   throw new Error(data.message);
// }

// export const auth = NestAuth(config);
