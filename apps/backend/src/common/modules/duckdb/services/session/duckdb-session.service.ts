import { DuckDBInstance } from "@duckdb/node-api";
import type { DuckDBResultReader } from "@duckdb/node-api";
import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";

import { DuckDbConfigService } from "../config/duckdb-config.service";

/**
 * Owns the process-wide DuckDB instance. Everything is lazy: the native
 * binding is only touched on the first query, so booting with the warehouse
 * adapter selected never initializes DuckDB.
 *
 * Data arrives via Delta Sharing pre-signed parquet URLs, so the only
 * extension needed is httpfs; there is no catalog attachment or credential
 * state to manage.
 */
@Injectable()
export class DuckDbSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(DuckDbSessionService.name);

  private instancePromise?: Promise<DuckDBInstance>;

  constructor(private readonly configService: DuckDbConfigService) {}

  async run(sql: string): Promise<DuckDBResultReader> {
    const instance = await this.getInstance();
    const connection = await instance.connect();
    try {
      return await connection.runAndReadAll(sql);
    } finally {
      connection.closeSync();
    }
  }

  onModuleDestroy(): void {
    if (this.instancePromise) {
      void this.instancePromise.then((instance) => instance.closeSync()).catch(() => undefined);
    }
  }

  private getInstance(): Promise<DuckDBInstance> {
    this.instancePromise ??= this.createInstance();
    return this.instancePromise;
  }

  private async createInstance(): Promise<DuckDBInstance> {
    if (!this.configService.isLocalMode()) {
      this.configService.assertReady();
    }

    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    try {
      await connection.run(`SET memory_limit = '${this.configService.getMemoryLimit()}'`);
      await connection.run(`SET threads = ${this.configService.getThreads()}`);

      const tempDirectory = this.configService.getTempDirectory();
      if (tempDirectory) {
        await connection.run(`SET temp_directory = '${tempDirectory}'`);
      }

      if (!this.configService.isLocalMode()) {
        const extensionDirectory = this.configService.getExtensionDirectory();
        if (extensionDirectory) {
          await connection.run(`SET extension_directory = '${extensionDirectory}'`);
        }
        // INSTALL is an idempotent no-op once the extension is on disk; the
        // first query per task fetches it via NAT egress.
        await connection.run("INSTALL httpfs");
        await connection.run("LOAD httpfs");
      }
    } finally {
      connection.closeSync();
    }

    this.logger.log({
      msg: "DuckDB instance initialized",
      operation: "createInstance",
      localMode: this.configService.isLocalMode(),
    });
    return instance;
  }
}
