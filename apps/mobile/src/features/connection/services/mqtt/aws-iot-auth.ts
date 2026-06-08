import { HmacSHA256, SHA256, enc, lib } from "crypto-js";
import "react-native-get-random-values";
import { getApiClient } from "~/shared/api/client";
import { createLogger } from "~/shared/observability/logger";
import { ensureSynced, getSyncedUtcDateTime, getTimeSyncState } from "~/shared/time/time-sync";

function sign(key: string | lib.WordArray, msg: string) {
  return HmacSHA256(msg, key).toString(enc.Hex);
}

function sha256(msg: string) {
  return SHA256(msg).toString(enc.Hex);
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  const kDate = HmacSHA256(dateStamp, `AWS4${key}`);
  const kRegion = HmacSHA256(region, kDate);
  const kService = HmacSHA256(service, kRegion);
  return HmacSHA256("aws4_request", kService);
}

function getAmazonDates() {
  const syncedDate = getSyncedUtcDateTime();
  const dateStamp = syncedDate.toFormat("yyyyMMdd");
  const amazonDate = syncedDate.toFormat("yyyyMMdd'T'HHmmss'Z'");
  const { timezone } = getTimeSyncState();
  return { amazonDate, dateStamp, timezone };
}

export async function createSignedUrl(params: {
  clientId: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  endpoint: string;
}) {
  // Block until the first time sync has completed so we never sign with an unsynced device clock.
  await ensureSynced();

  const method = "GET";
  const service = "iotdevicegateway";
  const canonicalUri = "/mqtt";

  const { amazonDate, dateStamp } = getAmazonDates();
  const credentialScope = `${dateStamp}/${params.region}/${service}/aws4_request`;

  let query = `X-Amz-Algorithm=AWS4-HMAC-SHA256`;
  query += `&X-Amz-Credential=${encodeURIComponent(`${params.accessKeyId}/${credentialScope}`)}`;
  query += `&X-Amz-Date=${amazonDate}`;
  query += `&X-Amz-Expires=86400`;
  query += `&X-Amz-SignedHeaders=host`;

  const canonicalHeaders = `host:${params.endpoint}\n`;
  const payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    canonicalHeaders,
    "host",
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amazonDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(params.secretAccessKey, dateStamp, params.region, service);
  const signature = sign(signingKey, stringToSign);

  query += `&X-Amz-Signature=${signature}`;

  if (params.sessionToken) {
    query += `&X-Amz-Security-Token=${encodeURIComponent(params.sessionToken)}`;
  }

  return `wss://${params.endpoint}${canonicalUri}?${query}`;
}

const logger = createLogger("aws-iot-auth");

// Developer-authenticated IoT credentials are valid for ~1h. Reuse the same
// set across every MQTT publish in that window — kept in memory only (never on
// disk: these *are* secrets). Refresh ~1 min before the reported expiration so
// a publish in flight doesn't race expiry.
const CREDENTIALS_SAFETY_MARGIN_MS = 60_000;

interface CachedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiresAt: number;
}

let cachedCredentials: CachedCredentials | null = null;
let inflightCredentialsPromise: Promise<CachedCredentials> | null = null;

function isStillValid(c: CachedCredentials): boolean {
  return c.expiresAt - Date.now() > CREDENTIALS_SAFETY_MARGIN_MS;
}

function toReturnShape(credentials: CachedCredentials) {
  return {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
  };
}

// Test seam — lets unit tests reset module-level cache state between runs.
export function _resetCredentialsCacheForTests(): void {
  cachedCredentials = null;
  inflightCredentialsPromise = null;
}

// Fetches temporary AWS IoT credentials from the backend, which mints them via
// Cognito developer-authenticated identities scoped to the signed-in user. The
// Better Auth session cookie is attached by the shared fetcher; a signed-out
// caller gets a 401 and a thrown error rather than silent anonymous access.
export async function getCredentials() {
  if (cachedCredentials && isStillValid(cachedCredentials)) {
    return toReturnShape(cachedCredentials);
  }
  if (inflightCredentialsPromise) {
    return toReturnShape(await inflightCredentialsPromise);
  }

  inflightCredentialsPromise = (async () => {
    const result = await getApiClient().iot.getCredentials();

    if (result.status !== 200) {
      throw new Error(`Failed to fetch IoT credentials: ${result.status}`);
    }

    const { accessKeyId, secretAccessKey, sessionToken, expiration } = result.body;

    if (!accessKeyId || !secretAccessKey || !sessionToken) {
      throw new Error("Missing one or more required AWS credential fields.");
    }

    const expiresAt = expiration ? new Date(expiration).getTime() : NaN;
    if (!Number.isFinite(expiresAt)) {
      // No silent long-lived fallback: a missing/invalid expiration is a
      // backend contract breach we must surface, not paper over.
      logger.error("IoT credentials missing or invalid expiration", { expiration });
      throw new Error("IoT credentials missing or invalid expiration field.");
    }

    const next: CachedCredentials = { accessKeyId, secretAccessKey, sessionToken, expiresAt };
    cachedCredentials = next;
    return next;
  })();

  try {
    const fresh = await inflightCredentialsPromise;
    return toReturnShape(fresh);
  } catch (err) {
    // Don't leave a poisoned cache pinned — let the next caller retry.
    cachedCredentials = null;
    throw err;
  } finally {
    inflightCredentialsPromise = null;
  }
}
