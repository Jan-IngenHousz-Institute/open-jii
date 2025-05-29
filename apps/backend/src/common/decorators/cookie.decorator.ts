import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator } from "@nestjs/common";
import type { Request } from "express";

// Define a safe type for cookies
type CookiesRecord = Record<string, string>;

export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext): string | CookiesRecord | undefined => {
    // Tell TypeScript this is an Express Request
    const request = ctx.switchToHttp().getRequest<Request>();
    // Ensure cookies is a plain object of strings
    const cookies: CookiesRecord = request.cookies;

    // If a specific key was requested, return its value, otherwise return the whole cookie object
    return data ? cookies[data] : cookies;
  },
);
