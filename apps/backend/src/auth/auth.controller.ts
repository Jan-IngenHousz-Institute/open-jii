import { Controller, Logger, Req, Res, Next } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

import { authContract } from "@repo/api";
import { auth } from "@repo/auth/express";

import { Result, success, AppError } from "../experiments/utils/fp-utils";
import { Cookies } from "./decorators/cookie.decorator";

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  @TsRestHandler(authContract.session)
  async session(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return tsRestHandler(authContract.session, async () => {
      try {
        await auth(req, res, next);
        return {
          status: StatusCodes.OK,
          body: { expires: new Date().toISOString() }, // This won't actually be used as auth will handle the response
        };
      } catch (error) {
        this.logger.error(`Error fetching session: ${(error as any).message}`);
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: { expires: new Date().toISOString() },
        };
      }
    });
  }

  @TsRestHandler(authContract.signOut)
  async signOut(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
    @Cookies("authjs.csrf-token") csrfToken: string,
  ) {
    return tsRestHandler(authContract.signOut, async () => {
      try {
        this.logger.log(req.body);
        await auth(req, res, next);

        // handle response after auth

        return {
          status: StatusCodes.OK,
          body: {}, // This won't actually be used as auth will handle the redirect
        };
      } catch (error) {
        this.logger.error(`Error signing out: ${(error as any).message}`);
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: { message: "Error signing out" },
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

  @TsRestHandler(authContract.providers)
  async providers(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return tsRestHandler(authContract.providers, async () => {
      try {
        await auth(req, res, next);
        return {
          status: StatusCodes.OK,
          body: {}, // This won't actually be used as auth will handle the response
        };
      } catch (error) {
        this.logger.error(
          `Error fetching providers: ${(error as any).message}`,
        );
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: {},
        };
      }
    });
  }
}
