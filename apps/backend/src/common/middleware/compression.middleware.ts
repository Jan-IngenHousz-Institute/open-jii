import { Injectable } from "@nestjs/common";
import type { NestMiddleware } from "@nestjs/common";
import compression from "compression";
import type { NextFunction, Request, Response } from "express";

/**
 * Chart responses run to megabytes of repetitive JSON, and the edge cannot
 * compress them for us: oRPC ends a JSON response without a Content-Length,
 * so CloudFront sees a chunked body and passes it through as is. An event
 * stream stays uncompressed, since the encoder would hold events back until
 * its buffer filled.
 */
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private readonly compress = compression({ filter: CompressionMiddleware.isCompressible });

  use(request: Request, response: Response, next: NextFunction): void {
    this.compress(request, response, next);
  }

  private static isCompressible(this: void, request: Request, response: Response): boolean {
    const contentType = response.getHeader("content-type");
    if (typeof contentType === "string" && contentType.startsWith("text/event-stream")) {
      return false;
    }
    return compression.filter(request, response);
  }
}
