import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ServingStoreConfig, servingStoreConfigSchema } from "./config.types";

@Injectable()
export class ServingStoreConfigService {
  private readonly logger = new Logger(ServingStoreConfigService.name);
  private readonly config: ServingStoreConfig | null;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
  }

  /** Null in an environment without a store. A store named without its credentials stops boot. */
  getConfig(): ServingStoreConfig | null {
    return this.config;
  }

  private loadConfig(): ServingStoreConfig | null {
    const url = this.configService.get<string>("servingStore.url") ?? "";
    if (url === "") {
      this.logger.log({ msg: "No serving store configured", operation: "loadConfig" });
      return null;
    }

    const parsed = servingStoreConfigSchema.safeParse({
      url,
      username: this.configService.get<string>("servingStore.username"),
      password: this.configService.get<string>("servingStore.password"),
    });
    if (!parsed.success) {
      // The issues name the fields only; a value could be the password.
      const fields = parsed.error.issues.map((issue) => issue.path.join("."));
      throw new Error(`Invalid serving store configuration: ${fields.join(", ")}`);
    }
    return parsed.data;
  }
}
