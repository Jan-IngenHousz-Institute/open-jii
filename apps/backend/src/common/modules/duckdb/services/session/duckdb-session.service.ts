import { DuckDBInstance } from "@duckdb/node-api";
import type { DuckDBResultReader } from "@duckdb/node-api";
import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";

import { AppError } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../../../databricks/services/auth/auth.service";
import { DuckDbConfigService } from "../config/duckdb-config.service";

const UC_ATTACH_ALIAS = "uc";
const UC_SECRET_NAME = "uc_backend";
const EXTENSIONS = ["delta", "unity_catalog", "httpfs"];

/**
 * Owns the process-wide DuckDB instance. Everything is lazy: the native
 * binding is only touched on the first query, so booting with the warehouse
 * adapter selected never initializes DuckDB.
 *
 * Unity Catalog attachment uses the shared Databricks OAuth token; when the
 * auth service rotates it, the secret and catalog are re-attached under a
 * serialized refresh so concurrent queries never race a half-attached state.
 */
@Injectable()
export class DuckDbSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(DuckDbSessionService.name);

  private instancePromise?: Promise<DuckDBInstance>;
  private attachedToken?: string;
  private refreshChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly configService: DuckDbConfigService,
    private readonly authService: DatabricksAuthService,
  ) {}

  async run(sql: string): Promise<DuckDBResultReader> {
    const instance = await this.getInstance();

    if (!this.configService.isLocalMode()) {
      await this.ensureFreshAttachment(instance);
    }

    const connection = await instance.connect();
    try {
      return await connection.runAndReadAll(sql);
    } finally {
      connection.closeSync();
    }
  }

  /**
   * Fully-quoted table reference. Local mode targets bare in-memory tables so
   * integration specs run without Unity Catalog.
   */
  tableRef(tableName: string): string {
    if (this.configService.isLocalMode()) {
      return DuckDbSessionService.quote(tableName);
    }
    return [
      UC_ATTACH_ALIAS,
      this.configService.getCentrumSchemaName(),
      tableName,
    ]
      .map((part) => DuckDbSessionService.quote(part))
      .join(".");
  }

  onModuleDestroy(): void {
    if (this.instancePromise) {
      void this.instancePromise.then((instance) => instance.closeSync()).catch(() => undefined);
    }
  }

  private static quote(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private getInstance(): Promise<DuckDBInstance> {
    this.instancePromise ??= this.createInstance();
    return this.instancePromise;
  }

  private async createInstance(): Promise<DuckDBInstance> {
    if (!this.configService.isLocalMode()) {
      this.configService.assertAttachable();
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
        for (const extension of EXTENSIONS) {
          await connection.run(`LOAD ${extension}`);
        }
        await this.attach(connection, await this.requireToken());
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

  private async requireToken(): Promise<string> {
    const tokenResult = await this.authService.getAccessToken();
    if (tokenResult.isFailure()) {
      throw tokenResult.error;
    }
    return tokenResult.value;
  }

  private async attach(
    connection: Awaited<ReturnType<DuckDBInstance["connect"]>>,
    token: string,
  ): Promise<void> {
    const host = this.configService.getHost();
    const catalog = this.configService.getCatalogName();

    await connection.run(`DETACH DATABASE IF EXISTS ${UC_ATTACH_ALIAS}`);
    await connection.run(
      `CREATE OR REPLACE SECRET ${UC_SECRET_NAME} (TYPE uc, TOKEN '${token.replace(/'/g, "''")}', ENDPOINT '${host.replace(/'/g, "''")}')`,
    );
    await connection.run(
      `ATTACH '${catalog.replace(/'/g, "''")}' AS ${UC_ATTACH_ALIAS} (TYPE uc_catalog, READ_ONLY)`,
    );
    this.attachedToken = token;
  }

  /** Re-attach when the shared OAuth token has rotated since ATTACH. */
  private async ensureFreshAttachment(instance: DuckDBInstance): Promise<void> {
    const token = await this.requireToken();
    if (token === this.attachedToken) {
      return;
    }

    this.refreshChain = this.refreshChain
      .catch(() => undefined)
      .then(async () => {
        if (token === this.attachedToken) {
          return;
        }
        this.logger.log({ msg: "Re-attaching Unity Catalog", operation: "ensureFreshAttachment" });
        const connection = await instance.connect();
        try {
          await this.attach(connection, token);
        } finally {
          connection.closeSync();
        }
      });

    await this.refreshChain.catch((error) => {
      throw error instanceof AppError
        ? error
        : AppError.internal(`Unity Catalog re-attach failed: ${String(error)}`);
    });
  }
}
