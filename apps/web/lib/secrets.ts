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
