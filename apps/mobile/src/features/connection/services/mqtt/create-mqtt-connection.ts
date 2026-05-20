import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from "@aws-sdk/client-cognito-identity";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HmacSHA256, SHA256, enc, lib } from "crypto-js";
import { Client, Message, MQTTError } from "paho-mqtt";
import "react-native-get-random-values";
import { getEnvVar } from "~/shared/stores/environment-store";
import { Emitter } from "~/shared/utils/emitter";
import { generateRandomString } from "~/shared/utils/generate-random-string";
import { createLogger } from "~/shared/utils/logger";
import { ensureSynced, getSyncedUtcDateTime, getTimeSyncState } from "~/shared/utils/time-sync";

const log = createLogger("mqtt-conn");

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

// Cognito IdentityId is durable per device + pool — once issued it can be
// reused forever. Calling GetId on every connection creates a brand-new
// identity each time (driving the pool's identity count up indefinitely)
// and adds a serial request to every upload. Persist it once and reuse.
const IDENTITY_ID_STORAGE_PREFIX = "cognito_identity_id:";

let cachedIdentityId: string | null = null;
let inflightIdentityIdPromise: Promise<string> | null = null;

function storageKeyFor(identityPoolId: string): string {
  return `${IDENTITY_ID_STORAGE_PREFIX}${identityPoolId}`;
}

async function fetchAndPersistIdentityId(
  identityClient: CognitoIdentityClient,
  identityPoolId: string,
): Promise<string> {
  const { IdentityId } = await identityClient.send(
    new GetIdCommand({ IdentityPoolId: identityPoolId }),
  );
  if (!IdentityId) throw new Error("Missing identity ID");
  try {
    await AsyncStorage.setItem(storageKeyFor(identityPoolId), IdentityId);
  } catch (e) {
    log.warn("Failed to persist Cognito IdentityId", { err: (e as Error)?.message });
  }
  cachedIdentityId = IdentityId;
  return IdentityId;
}

async function getOrCreateIdentityId(
  identityClient: CognitoIdentityClient,
  identityPoolId: string,
): Promise<string> {
  if (cachedIdentityId) return cachedIdentityId;
  if (inflightIdentityIdPromise) return inflightIdentityIdPromise;

  inflightIdentityIdPromise = (async () => {
    const stored = await AsyncStorage.getItem(storageKeyFor(identityPoolId));
    if (stored) {
      cachedIdentityId = stored;
      return stored;
    }
    return fetchAndPersistIdentityId(identityClient, identityPoolId);
  })();

  try {
    return await inflightIdentityIdPromise;
  } finally {
    inflightIdentityIdPromise = null;
  }
}

async function clearCachedIdentityId(identityPoolId: string): Promise<void> {
  cachedIdentityId = null;
  try {
    await AsyncStorage.removeItem(storageKeyFor(identityPoolId));
  } catch (e) {
    log.warn("Failed to clear persisted Cognito IdentityId", { err: (e as Error)?.message });
  }
}

// Cognito unauth credentials are valid for ~1h. Reuse the same set across
// every MQTT publish in that window — kept in memory only (never on disk:
// these *are* secrets, unlike the IdentityId above). Refresh ~1 min before
// the SDK-reported Expiration so a publish in flight doesn't race expiry.
const CREDENTIALS_SAFETY_MARGIN_MS = 60_000;
// Fallback TTL if the SDK doesn't populate Expiration (shouldn't happen for
// Cognito, but defend against an undefined slipping through to NaN math).
const CREDENTIALS_FALLBACK_TTL_MS = 50 * 60_000;

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

function toReturnShape(c: CachedCredentials) {
  return {
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    sessionToken: c.sessionToken,
  };
}

// Test seam — lets unit tests reset module-level cache state between runs.
export function _resetIdentityIdCacheForTests(): void {
  cachedIdentityId = null;
  inflightIdentityIdPromise = null;
}

export function _resetCredentialsCacheForTests(): void {
  cachedCredentials = null;
  inflightCredentialsPromise = null;
}

export async function getCredentials({
  region,
  identityPoolId,
}: {
  region: string;
  identityPoolId: string;
}) {
  if (cachedCredentials && isStillValid(cachedCredentials)) {
    return toReturnShape(cachedCredentials);
  }
  if (inflightCredentialsPromise) {
    return toReturnShape(await inflightCredentialsPromise);
  }

  inflightCredentialsPromise = (async () => {
    const identityClient = new CognitoIdentityClient({ region });

    const fetchCredentialsFor = async (IdentityId: string) => {
      const { Credentials } = await identityClient.send(
        new GetCredentialsForIdentityCommand({ IdentityId }),
      );
      if (!Credentials) throw new Error("Missing credentials");
      return Credentials;
    };

    let IdentityId = await getOrCreateIdentityId(identityClient, identityPoolId);
    let Credentials;
    try {
      Credentials = await fetchCredentialsFor(IdentityId);
    } catch (err) {
      // The cached identity may have been deleted out from under us (manual
      // pool cleanup, expired unauth identity, etc). Drop the cache, mint a
      // fresh one, and try exactly once more.
      const name = (err as { name?: string })?.name;
      if (name === "ResourceNotFoundException" || name === "NotAuthorizedException") {
        log.warn("Cached IdentityId rejected — refreshing", { name });
        await clearCachedIdentityId(identityPoolId);
        IdentityId = await fetchAndPersistIdentityId(identityClient, identityPoolId);
        Credentials = await fetchCredentialsFor(IdentityId);
      } else {
        throw err;
      }
    }

    const {
      AccessKeyId: accessKeyId,
      SecretKey: secretAccessKey,
      SessionToken: sessionToken,
      Expiration,
    } = Credentials;

    if (!accessKeyId || !secretAccessKey || !sessionToken) {
      throw new Error("Missing one or more required AWS credential fields.");
    }

    const expiresAt = Expiration
      ? new Date(Expiration).getTime()
      : Date.now() + CREDENTIALS_FALLBACK_TTL_MS;

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

function connectToMqtt(url: string, clientId: string) {
  const client = new Client(url, clientId);

  return new Promise<Client>((resolve, reject) => {
    client.connect({
      onSuccess: () => resolve(client),
      onFailure: reject,
      useSSL: true,
      timeout: 3,
    });
  });
}

export interface ReceivedMessage {
  payload: string;
  destinationName: string;
}

export interface MqttEmitterEvents {
  messageArrived: ReceivedMessage;
  connectionLost: MQTTError;
  sendMessage: { payload: string; topic: string };
  destroy: void;
  messageDelivered: ReceivedMessage;
}

export async function createMqttConnection() {
  const t0 = Date.now();
  const { accessKeyId, secretAccessKey, sessionToken } = await getCredentials({
    identityPoolId: getEnvVar("IDENTITY_POOL_ID"),
    region: getEnvVar("REGION"),
  });
  const tCreds = Date.now();

  const clientId = getEnvVar("CLIENT_ID") + " - " + generateRandomString();

  const signedUrl = await createSignedUrl({
    clientId,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region: getEnvVar("REGION"),
    endpoint: getEnvVar("IOT_ENDPOINT"),
  });
  const tSign = Date.now();

  const client = await connectToMqtt(signedUrl, clientId);
  log.info("connected", {
    clientId,
    creds_ms: tCreds - t0,
    sign_ms: tSign - tCreds,
    paho_ms: Date.now() - tSign,
    total_ms: Date.now() - t0,
  });

  const emitter = new Emitter<MqttEmitterEvents>();

  client.onMessageArrived = (message: Message) => {
    const { payloadString: payload, destinationName } = message;

    emitter
      .emit("messageArrived", { destinationName, payload })
      .catch((e) => log.warn("messageArrived emit failed", { err: (e as Error)?.message }));
  };

  client.onConnectionLost = (err) => {
    emitter
      .emit("connectionLost", err)
      .catch((e) => log.warn("connectionLost emit failed", { err: (e as Error)?.message }));
  };

  emitter.on("sendMessage", ({ payload, topic }) => {
    client.send(topic, payload);
  });

  emitter.on("destroy", () => client.disconnect());

  client.onMessageDelivered = (message) => {
    const { payloadString: payload, destinationName } = message;
    emitter
      .emit("messageDelivered", { payload, destinationName })
      .catch((e) => log.warn("messageDelivered emit failed", { err: (e as Error)?.message }));
  };

  return emitter;
}
