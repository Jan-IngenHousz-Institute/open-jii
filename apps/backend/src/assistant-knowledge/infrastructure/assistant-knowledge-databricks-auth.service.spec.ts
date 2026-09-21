import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it } from "vitest";

import type { DatabricksConfigService } from "../../common/modules/databricks/services/config/config.service";
import {
  ASSISTANT_KNOWLEDGE_DEV_HOST,
  AssistantKnowledgeDatabricksAuthService,
} from "./assistant-knowledge-databricks-auth.service";

describe("AssistantKnowledgeDatabricksAuthService", () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnvironment;
  });

  it("rejects CLI authentication in production", async () => {
    process.env.NODE_ENV = "production";
    const service = createService(ASSISTANT_KNOWLEDGE_DEV_HOST);

    const result = await service.getAccessToken();

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) expect(result.error.code).toBe("DATABRICKS_AUTH_FAILED");
  });

  it("rejects CLI authentication outside the pinned development workspace", async () => {
    process.env.NODE_ENV = "development";
    const service = createService("https://example.cloud.databricks.com");

    const result = await service.getAccessToken();

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) expect(result.error.code).toBe("DATABRICKS_AUTH_FAILED");
  });
});

function createService(host: string): AssistantKnowledgeDatabricksAuthService {
  const environment = new ConfigService({ ASSISTANT_KNOWLEDGE_AUTH: "cli" });
  const databricksConfig = { getHost: () => host } as DatabricksConfigService;
  return new AssistantKnowledgeDatabricksAuthService(environment, databricksConfig, {} as never);
}
