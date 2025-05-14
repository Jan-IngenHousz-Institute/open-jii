import { Controller, Logger, Req, Res, Next } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

import { authContract } from "@repo/api";
import { auth } from "@repo/auth/express";

import { Result, success, AppError } from "../experiments/utils/fp-utils";

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  @TsRestHandler(authContract.signInPage)
  async signInPage(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return tsRestHandler(authContract.signInPage, async () => {
      try {
        await auth(req, res, next);
        return {
          status: StatusCodes.OK,
          body: "", // This won't actually be used as auth will handle the response
        };
      } catch (error) {
        this.logger.error(
          `Error displaying sign-in page: ${(error as any).message}`,
        );
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: "Error displaying sign-in page",
        };
      }
    });
  }

  @TsRestHandler(authContract.signIn)
  async signIn(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return tsRestHandler(authContract.signIn, async () => {
      try {
        await auth(req, res, next);
        return {
          status: StatusCodes.OK,
          body: "", // This won't actually be used as auth will handle the response
        };
      } catch (error) {
        this.logger.error(
          `Error displaying sign-in page: ${(error as any).message}`,
        );
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: "Error displaying sign-in page",
        };
      }
    });
  }

  @TsRestHandler(authContract.callback)
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return tsRestHandler(authContract.callback, async () => {
      try {
        await auth(req, res, next);
        return {
          status: StatusCodes.TEMPORARY_REDIRECT,
          body: { url: "/" }, // This won't actually be used as auth will handle the redirect
        };
      } catch (error) {
        this.logger.error(`Error during callback: ${(error as any).message}`);
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: { url: "/api/v1/auth/error" },
        };
      }
    });
  }

  @TsRestHandler(authContract.error)
  async error(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return tsRestHandler(authContract.error, async () => {
      try {
        await auth(req, res, next);
        return {
          status: StatusCodes.OK,
          body: "", // This won't actually be used as auth will handle the redirect
        };
      } catch (error) {
        this.logger.error(`Error during callback: ${(error as any).message}`);
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: "Error",
        };
      }
    });
  }

  // @TsRestHandler(authContract.signOutPage)
  // async signOutPage() {
  //   return tsRestHandler(
  //     authContract.signOutPage,
  //     async ({ req, res, next }) => {
  //       try {
  //         await auth(req as Request, res as Response, next as NextFunction);
  //         return {
  //           status: StatusCodes.OK,
  //           body: "Sign out page HTML", // This won't actually be used as auth will handle the response
  //         };
  //       } catch (error) {
  //         this.logger.error(`Error displaying sign-out page: ${error.message}`);
  //         return {
  //           status: StatusCodes.INTERNAL_SERVER_ERROR,
  //           body: "Error displaying sign-out page",
  //         };
  //       }
  //     },
  //   );
  // }

  // @TsRestHandler(authContract.signOut)
  // async signOut() {
  //   return tsRestHandler(authContract.signOut, async ({ req, res, next }) => {
  //     try {
  //       await auth(req as Request, res as Response, next as NextFunction);
  //       return {
  //         status: StatusCodes.FOUND,
  //         body: { url: "/" }, // This won't actually be used as auth will handle the redirect
  //       };
  //     } catch (error) {
  //       this.logger.error(`Error signing out: ${error.message}`);
  //       return {
  //         status: StatusCodes.INTERNAL_SERVER_ERROR,
  //         body: { url: "/api/v1/auth/error" },
  //       };
  //     }
  //   });
  // }

  // @TsRestHandler(authContract.session)
  // async session() {
  //   return tsRestHandler(authContract.session, async ({ req, res, next }) => {
  //     try {
  //       await auth(req as Request, res as Response, next as NextFunction);
  //       return {
  //         status: StatusCodes.OK,
  //         body: { expires: new Date().toISOString() }, // This won't actually be used as auth will handle the response
  //       };
  //     } catch (error) {
  //       this.logger.error(`Error fetching session: ${error.message}`);
  //       return {
  //         status: StatusCodes.INTERNAL_SERVER_ERROR,
  //         body: { expires: new Date().toISOString() },
  //       };
  //     }
  //   });
  // }

  @TsRestHandler(authContract.csrf)
  async csrf(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return tsRestHandler(authContract.csrf, async () => {
      try {
        await auth(req, res, next);
        return {
          status: StatusCodes.OK,
          body: { csrfToken: "" }, // This won't actually be used as auth will handle the response
        };
      } catch (error) {
        this.logger.error(
          `Error fetching CSRF token: ${(error as any).message}`,
        );
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: { csrfToken: "" },
        };
      }
    });
  }

  // @TsRestHandler(authContract.providers)
  // async providers() {
  //   return tsRestHandler(authContract.providers, async ({ req, res, next }) => {
  //     try {
  //       await auth(req as Request, res as Response, next as NextFunction);
  //       return {
  //         status: StatusCodes.OK,
  //         body: {}, // This won't actually be used as auth will handle the response
  //       };
  //     } catch (error) {
  //       this.logger.error(`Error fetching providers: ${error.message}`);
  //       return {
  //         status: StatusCodes.INTERNAL_SERVER_ERROR,
  //         body: {},
  //       };
  //     }
  //   });
  // }
}
