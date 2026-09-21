import { registerAs } from "@nestjs/config";

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default registerAs("assistant", () => ({
  enabled: process.env.ASSISTANT_ENABLED === "true",
  agentUrl: process.env.ASSISTANT_AGENT_URL,
  trustedAgentHost: process.env.ASSISTANT_AGENT_TRUSTED_HOST,
  gatewayToken: process.env.ASSISTANT_GATEWAY_TOKEN,
  modelEndpoint: process.env.ASSISTANT_DATABRICKS_MODEL ?? "databricks-gpt-5-6-luna",
  dailyTokenLimit: integer(process.env.ASSISTANT_DAILY_TOKEN_LIMIT, 100_000),
  maxTotalTokens: Math.min(integer(process.env.ASSISTANT_MAX_TOTAL_TOKENS, 100_000), 100_000),
  maxToolRounds: integer(process.env.ASSISTANT_MAX_TOOL_ROUNDS, 4),
  maxOutputTokens: integer(process.env.ASSISTANT_MAX_OUTPUT_TOKENS, 2_000),
  operatorUserIds: (process.env.ASSISTANT_OPERATOR_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
}));
