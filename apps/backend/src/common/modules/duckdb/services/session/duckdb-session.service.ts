import type { DuckDBInstance, DuckDBResultReader } from "@duckdb/node-api";
import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";

import { DuckDbConfigService } from "../config/duckdb-config.service";

/** SQL string literal for a settings value. */
function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

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

  async onModuleDestroy(): Promise<void> {
    const pending = this.instancePromise;
    this.instancePromise = undefined;
    if (!pending) {
      return;
    }
    try {
      (await pending).closeSync();
    } catch (error) {
      this.logger.warn({
        msg: "DuckDB instance close failed",
        operation: "onModuleDestroy",
        error,
      });
    }
  }

  private getInstance(): Promise<DuckDBInstance> {
    // A rejected init must not be memoized: the first query after deploy can
    // fail on a transient extension fetch, and a cached rejection would brick
    // the task for its whole lifetime (the health check never touches DuckDB).
    this.instancePromise ??= this.createInstance().catch((error: unknown) => {
      this.instancePromise = undefined;
      throw error;
    });
    return this.instancePromise;
  }

  private async createInstance(): Promise<DuckDBInstance> {
    if (!this.configService.isLocalMode()) {
      this.configService.assertReady();
    }

    // Imported here, not at module scope: the package loads a native binding
    // on import, which would abort boot on a platform without a prebuild even
    // when the warehouse adapter is selected and DuckDB is never used.
    const { DuckDBInstance: Instance } = await import("@duckdb/node-api");
    const instance = await Instance.create(":memory:");
    let connection: Awaited<ReturnType<DuckDBInstance["connect"]>> | undefined;
    try {
      connection = await instance.connect();
      // Spark runs these tables in UTC. Without this, date_trunc buckets and
      // bare timestamp literals in filters resolve against the container's
      // local zone, shifting every time series by the host offset.
      await connection.run("SET TimeZone = 'UTC'");
      await connection.run(
        `SET memory_limit = ${quoteLiteral(this.configService.getMemoryLimit())}`,
      );
      await connection.run(`SET threads = ${this.configService.getThreads()}`);

      const tempDirectory = this.configService.getTempDirectory();
      if (tempDirectory) {
        await connection.run(`SET temp_directory = ${quoteLiteral(tempDirectory)}`);
      }

      if (!this.configService.isLocalMode()) {
        const extensionDirectory = this.configService.getExtensionDirectory();
        if (extensionDirectory) {
          await connection.run(`SET extension_directory = ${quoteLiteral(extensionDirectory)}`);
        }
        // INSTALL is an idempotent no-op once the extension is on disk; the
        // first query per task fetches it over egress.
        await connection.run("INSTALL httpfs");
        await connection.run("LOAD httpfs");
      }
    } catch (error) {
      instance.closeSync();
      throw error;
    } finally {
      connection?.closeSync();
    }

    this.logger.log({
      msg: "DuckDB instance initialized",
      operation: "createInstance",
      localMode: this.configService.isLocalMode(),
    });
    return instance;
  }
}
