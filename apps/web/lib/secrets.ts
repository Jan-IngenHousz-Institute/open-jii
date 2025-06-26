/* eslint-disable no-restricted-properties */
/* eslint-disable turbo/no-undeclared-env-vars */
import http from "http";

export type SecretMap = Record<string, string>;
const _cache: Record<string, SecretMap> = {};

/**
 * Checks if code is running in AWS Lambda environment
 */
export function isLambdaEnvironment(): boolean {
  return !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

/**
 * Fetches a JSON secret from the Lambda Parameters & Secrets extension.
 * Built-in extension cache (300s TTL) + in-process memo avoids repeated calls.
 */
export async function fetchSecret(secretArn: string): Promise<SecretMap> {
  // Early return for local development
  if (!isLambdaEnvironment()) {
    return {};
  }

  // Check if we already have this secret in cache
  if (secretArn in _cache) {
    return _cache[secretArn];
  }

  // If not cached, fetch it
  return new Promise<SecretMap>((resolve) => {
    const options = {
      hostname: "localhost",
      port: 2773,
      path: `/secretsmanager/get?secretId=${encodeURIComponent(secretArn)}`,
      headers: {
        "X-Aws-Parameters-Secrets-Token": process.env.AWS_SESSION_TOKEN ?? "",
      },
    };

    http
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            console.error(`Failed to fetch secret: HTTP ${res.statusCode}`);
            _cache[secretArn] = {};
            return resolve({});
          }

          try {
            const wrapper = JSON.parse(data) as { SecretString: string };
            const secretValue = JSON.parse(wrapper.SecretString) as SecretMap;
            _cache[secretArn] = secretValue; // Cache the result
            resolve(secretValue);
          } catch (error) {
            console.error("Failed to parse secret:", error);
            _cache[secretArn] = {};
            resolve({});
          }
        });
      })
      .on("error", (error) => {
        console.error("Secret fetch error:", error);
        _cache[secretArn] = {};
        resolve({});
      });
  });
}

/**
 * Loads OAuth-related secrets directly from AWS Secrets Manager.
 * In Lambda, the secrets will be available with the same keys as environment variables.
 * This makes it easier to integrate with existing code that uses process.env.
 */
export async function loadOAuthSecrets(): Promise<Record<string, string>> {
  // If not in Lambda or no secret ARN provided, return empty object
  if (!isLambdaEnvironment() || !process.env.OAUTH_SECRET_ARN) {
    return {};
  }

  try {
    // Just return the raw secrets - they should be stored with the same keys as env vars
    return await fetchSecret(process.env.OAUTH_SECRET_ARN);
  } catch {
    return {};
  }
}

// Cache for environment values to avoid repeated secret loads
const secretsCache: Record<string, string | undefined> = {};

/**
 * Gets a secret value from AWS Secrets Manager by ARN.
 * In non-Lambda environments, it returns an empty object or undefined value.
 */
export async function getSecret(secretArn: string): Promise<SecretMap>;
export async function getSecret(secretArn: string, key: string): Promise<string | undefined>;
export async function getSecret(
  secretArn: string,
  key?: string,
): Promise<string | undefined | SecretMap> {
  // Return empty in non-Lambda environments
  if (!isLambdaEnvironment()) {
    return key ? undefined : {};
  }

  // Check cache for this secret ARN
  const cacheKey = secretArn;
  if (!(cacheKey in secretsCache)) {
    try {
      // Fetch the secret data
      const secretData = await fetchSecret(secretArn);

      // Cache all values from this secret
      for (const [k, v] of Object.entries(secretData)) {
        secretsCache[`${secretArn}:${k}`] = v;
      }

      // If a specific key was requested, return that value
      if (key) {
        return secretData[key];
      }

      // Otherwise return the entire secret map
      return secretData;
    } catch {
      return key ? undefined : {};
    }
  } else if (key) {
    // Return the specific key from cache
    return secretsCache[`${secretArn}:${key}`];
  }

  // This should not happen with proper usage
  return {};
}
