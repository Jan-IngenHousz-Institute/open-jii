/* eslint-disable no-restricted-properties */
import http from "http";

export type SecretMap = Record<string, string>;
const _cache: Record<string, SecretMap> = {};

/**
 * Checks if code is running in AWS Lambda environment
 */
export function isLambdaEnvironment(): boolean {
  return !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

function fetchSecretOnce(secretArn: string): Promise<SecretMap> {
  return new Promise<SecretMap>((resolve, reject) => {
    const port = parseInt(process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? "2773", 10);
    const options = {
      hostname: "localhost",
      port,
      path: `/secretsmanager/get?secretId=${encodeURIComponent(secretArn)}`,
      headers: {
        "X-Aws-Parameters-Secrets-Token": process.env.AWS_SESSION_TOKEN ?? "",
      },
    };

    http
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Secret fetch HTTP ${res.statusCode}: ${data}`));
          }

          try {
            const wrapper = JSON.parse(data) as { SecretString: string };
            const secretValue = JSON.parse(wrapper.SecretString) as SecretMap;
            resolve(secretValue);
          } catch (error) {
            reject(new Error(`Failed to parse secret: ${error}`));
          }
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Fetches a JSON secret from the Lambda Parameters & Secrets extension.
 * Retries on connection errors (e.g. ECONNRESET during cold start).
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

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const secretValue = await fetchSecretOnce(secretArn);
      _cache[secretArn] = secretValue;
      return secretValue;
    } catch (error) {
      console.error(`Secret fetch attempt ${attempt}/${MAX_RETRIES} failed:`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }
  }

  // All retries exhausted - do NOT cache failures
  console.error(`All ${MAX_RETRIES} secret fetch attempts failed for ${secretArn}`);
  return {};
}

/**
 * Fetches a JSON secret from the Lambda Parameters & Secrets extension.
 * Retries with backoff to handle cold-start race where the extension sidecar
 * isn't ready yet (ECONNRESET). Only caches successful results.
 */
export async function fetchSecret(secretArn: string): Promise<SecretMap> {
  // Early return for local development
  if (!isLambdaEnvironment()) {
    return {};
  }

  // Only return cached value if it was a successful fetch
  if (secretArn in _cache) {
    return _cache[secretArn];
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      const secretValue = await fetchSecretOnce(secretArn);
      _cache[secretArn] = secretValue; // Only cache on success
      return secretValue;
    } catch (error) {
      lastError = error;
      console.error(`Secret fetch attempt ${attempt + 1} failed:`, error);
    }
  }

  console.error("All secret fetch attempts failed:", lastError);
  return {};
}

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

  try {
    const secretData = await fetchSecret(secretArn);

    if (key) {
      return secretData[key];
    }

    return secretData;
  } catch {
    return key ? undefined : {};
  }
}
