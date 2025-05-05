import { z } from "zod";

// Types for environment configuration
export type EnvConfig<
  TServer extends Record<string, z.ZodType> = Record<string, never>,
  TClient extends Record<string, z.ZodType> = Record<string, never>,
> = {
  server?: TServer;
  client?: TClient;
  runtimeEnv: Record<string, unknown>;
  clientPrefix?: string;
  skipValidation?: boolean;
  emptyStringAsUndefined?: boolean;
};

// Transform an empty string to undefined
const emptyStringToUndefined = (value: unknown) => {
  return typeof value === "string" && value === "" ? undefined : value;
};

/**
 * Create environment validation and accessor
 * @param config Environment configuration with schemas and runtime values
 * @returns Validated environment variables
 */
export function createEnv<
  TServer extends Record<string, z.ZodType> = Record<string, never>,
  TClient extends Record<string, z.ZodType> = Record<string, never>,
>(config: EnvConfig<TServer, TClient>) {
  const {
    server = {} as TServer,
    client = {} as TClient,
    runtimeEnv,
    clientPrefix = "PUBLIC_",
    skipValidation = false,
    emptyStringAsUndefined = true,
  } = config;

  // Process environment variables
  const processEnv = emptyStringAsUndefined
    ? Object.entries(runtimeEnv).reduce(
        (acc, [key, value]) => {
          acc[key] = emptyStringToUndefined(value);
          return acc;
        },
        {} as Record<string, unknown>,
      )
    : runtimeEnv;

  // Format errors for better readability
  const formatErrors = (
    errors: z.ZodFormattedError<Map<string, string>, string>,
  ) => {
    return Object.entries(errors)
      .map(([name, value]) => {
        if (
          value &&
          typeof value === "object" &&
          "join" in value &&
          typeof value.join === "function"
        ) {
          // value is an array of error messages
          return `${name}: ${(value as string[]).join(", ")}\n`;
        }
        return null;
      })
      .filter(Boolean)
      .join("\n");
  };

  // Skip validation in production or when explicitly requested
  if (!skipValidation) {
    // Validate server environment variables
    const serverSchema = z.object(server);
    const serverResult = serverSchema.safeParse(processEnv);

    if (!serverResult.success) {
      console.error("❌ Invalid server environment variables:");
      console.error(formatErrors(serverResult.error.format()));
      throw new Error(
        `Invalid server environment variables:\n${formatErrors(
          serverResult.error.format(),
        )}`,
      );
    }

    // Validate client environment variables (those with clientPrefix)
    const clientEnvSchema = z.object(client);
    const clientEnv = Object.entries(processEnv)
      .filter(([key]) => key.startsWith(clientPrefix))
      .reduce(
        (acc, [key, value]) => {
          acc[key.replace(clientPrefix, "")] = value;
          return acc;
        },
        {} as Record<string, unknown>,
      );

    const clientResult = clientEnvSchema.safeParse(clientEnv);

    if (!clientResult.success) {
      console.error("❌ Invalid client environment variables:");
      console.error(formatErrors(clientResult.error.format()));
      throw new Error(
        `Invalid client environment variables:\n${formatErrors(
          clientResult.error.format(),
        )}`,
      );
    }
  }

  // Create type-safe accessors for environment variables
  const env = {} as {
    server: { [K in keyof TServer]: z.infer<TServer[K]> };
    client: { [K in keyof TClient]: z.infer<TClient[K]> };
  };

  // Add server values
  env.server = {} as { [K in keyof TServer]: z.infer<TServer[K]> };
  for (const key of Object.keys(server)) {
    const value = processEnv[key];
    const schema = server[key as keyof TServer];
    try {
      env.server[key as keyof TServer] = schema.parse(value) as any;
    } catch (error) {
      if (!skipValidation) throw error;
    }
  }

  // Add client values
  env.client = {} as { [K in keyof TClient]: z.infer<TClient[K]> };
  for (const key of Object.keys(client)) {
    const envKey = `${clientPrefix}${key}`;
    const value = processEnv[envKey];
    const schema = client[key as keyof TClient];
    try {
      env.client[key as keyof TClient] = schema.parse(value) as any;
    } catch (error) {
      if (!skipValidation) throw error;
    }
  }

  return env;
}
