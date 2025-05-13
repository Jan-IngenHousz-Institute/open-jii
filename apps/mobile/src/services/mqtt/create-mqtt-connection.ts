import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from "@aws-sdk/client-cognito-identity";
import { HmacSHA256, SHA256, enc, lib } from "crypto-js";
import { Client, Message, MQTTError } from "paho-mqtt";
import "react-native-get-random-values";

import { assertEnvVariables } from "~/utils/assert";
import { Emitter } from "~/utils/emitter";
import { generateRandomString } from "~/utils/generate-random-string";

function sign(key: string | lib.WordArray, msg: string) {
  return HmacSHA256(msg, key).toString(enc.Hex);
}

function sha256(msg: string) {
  return SHA256(msg).toString(enc.Hex);
}

function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string,
) {
  const kDate = HmacSHA256(dateStamp, `AWS4${key}`);
  const kRegion = HmacSHA256(region, kDate);
  const kService = HmacSHA256(service, kRegion);
  return HmacSHA256("aws4_request", kService);
}

function getAmzDates() {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, "");
  const amzDate = `${dateStamp}T${timePart}Z`;
  return { amzDate, dateStamp };
}

export function createSignedUrl(params: {
  clientId: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  endpoint: string;
}) {
  const method = "GET";
  const service = "iotdevicegateway";
  const canonicalUri = "/mqtt";

  const { amzDate, dateStamp } = getAmzDates();
  const credentialScope = `${dateStamp}/${params.region}/${service}/aws4_request`;

  let query = `X-Amz-Algorithm=AWS4-HMAC-SHA256`;
  query += `&X-Amz-Credential=${encodeURIComponent(`${params.accessKeyId}/${credentialScope}`)}`;
  query += `&X-Amz-Date=${amzDate}`;
  query += `&X-Amz-Expires=86400`;
  query += `&X-Amz-SignedHeaders=host`;

  const canonicalHeaders = `host:${params.endpoint}\n`;
  const payloadHash =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

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
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(
    params.secretAccessKey,
    dateStamp,
    params.region,
    service,
  );
  const signature = sign(signingKey, stringToSign);

  query += `&X-Amz-Signature=${signature}`;

  if (params.sessionToken) {
    query += `&X-Amz-Security-Token=${encodeURIComponent(params.sessionToken)}`;
  }

  return `wss://${params.endpoint}${canonicalUri}?${query}`;
}

async function getCredentials({
  region,
  identityPoolId,
}: {
  region: string;
  identityPoolId: string;
}) {
  const identityClient = new CognitoIdentityClient({ region });
  const { IdentityId } = await identityClient.send(
    new GetIdCommand({ IdentityPoolId: identityPoolId }),
  );
  if (!IdentityId) throw new Error("Missing identity ID");

  const { Credentials } = await identityClient.send(
    new GetCredentialsForIdentityCommand({ IdentityId }),
  );

  if (!Credentials) throw new Error("Missing credentials");

  const {
    AccessKeyId: accessKeyId,
    SecretKey: secretAccessKey,
    SessionToken: sessionToken,
  } = Credentials;

  if (!accessKeyId || !secretAccessKey || !sessionToken) {
    throw new Error("Missing one or more required environment variables.");
  }

  return { accessKeyId, secretAccessKey, sessionToken };
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

const {
  CLIENT_ID,
  REGION,
  IOT_ENDPOINT,
  IDENTITY_POOL_ID,
} = assertEnvVariables({
  REGION: process.env.REGION,
  IDENTITY_POOL_ID: process.env.IDENTITY_POOL_ID,
  IOT_ENDPOINT: process.env.IOT_ENDPOINT,
  CLIENT_ID: process.env.CLIENT_ID,
});

const clientId = CLIENT_ID + ' - ' + generateRandomString()

export interface ReceivedMessage {
  payload: string,
  destinationName: string
}

export interface MqttEmitterEvents {
  messageArrived: ReceivedMessage,
  connectionLost: MQTTError,
  sendMessage: { payload: string, topic: string },
  destroy: void
  messageDelivered: ReceivedMessage,
}

export async function createMqttConnection() {
  const { accessKeyId, secretAccessKey, sessionToken } = await getCredentials({
    identityPoolId: IDENTITY_POOL_ID,
    region: REGION,
  });

  const signedUrl = createSignedUrl({
    clientId,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region: REGION,
    endpoint: IOT_ENDPOINT,
  });

  const client = await connectToMqtt(signedUrl, clientId);

  const emitter = new Emitter<MqttEmitterEvents>()

  client.onMessageArrived = (message: Message) => {
    const { payloadString: payload, destinationName } = message;

    emitter.emit("messageArrived", { destinationName, payload })
      .catch(e => console.log('messageArrived error', e));
  };

  client.onConnectionLost = (err) => {
    emitter.emit("connectionLost", err)
      .catch(e => console.log('connectionLost error', e));
  };

  emitter.on('sendMessage', ({ payload, topic }) => {
    client.send(topic, payload);
  })

  emitter.on('destroy', () => client.disconnect());

  client.onMessageDelivered = (message) => {
    const { payloadString: payload, destinationName } = message;
    emitter.emit('messageDelivered', { payload, destinationName });
  }

  return emitter;
}
