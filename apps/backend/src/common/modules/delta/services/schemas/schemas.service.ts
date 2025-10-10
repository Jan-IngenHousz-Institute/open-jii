import { Injectable } from "@nestjs/common";

import { DeltaSharesService } from "../shares/shares.service";

/**
 * Service for managing Delta Sharing schemas
 * This is a thin wrapper around shares service for schema operations
 */
@Injectable()
export class DeltaSchemasService {
  constructor(private readonly sharesService: DeltaSharesService) {}

  /**
   * List schemas in a share - delegates to shares service
   */
  async listSchemas(shareName: string, maxResults?: number, pageToken?: string) {
    return this.sharesService.listSchemas(shareName, maxResults, pageToken);
  }
}
