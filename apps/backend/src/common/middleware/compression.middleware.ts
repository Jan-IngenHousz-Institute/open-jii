import { Injectable } from "@nestjs/common";
import type { NestMiddleware } from "@nestjs/common";
import compression from "compression";
import type { NextFunction, Request, Response } from "express";

/**
 * Chart responses run to megabytes of repetitive JSON. The API distribution
 * does not compress, and could not for these responses anyway: oRPC ends a
 * JSON response without a Content-Length, and CloudFront only compresses a
 * body whose length it knows. An event stream stays uncompressed, since the
 * encoder would hold events back until its buffer filled. NDJSON is text the
 * default filter's media type table does not know, so it is allowed by name.
 */
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private readonly compress = compression({ filter: CompressionMiddleware.isCompressible });

  use(request: Request, response: Response, next: NextFunction): void {
    this.compress(request, response, next);
  }

  private static isCompressible(this: void, request: Request, response: Response): boolean {
    const contentType = response.getHeader("content-type");
    const mediaType = typeof contentType === "string" ? contentType : "";

    if (mediaType.startsWith("text/event-stream")) {
      return false;
    }
    if (mediaType.startsWith("application/x-ndjson")) {
      return true;
    }
    return compression.filter(request, response);
  }
}
