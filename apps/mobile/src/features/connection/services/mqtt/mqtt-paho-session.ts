import { Client, Message } from "paho-mqtt";
import "react-native-get-random-values";
import { getEnvVar } from "~/shared/stores/environment-store";
import { generateRandomString } from "~/shared/utils/generate-random-string";
import { createLogger } from "~/shared/utils/logger";

import { createSignedUrl, getCredentials } from "./create-mqtt-connection";
import { MqttError } from "./mqtt-errors";

const log = createLogger("mqtt-paho-session");

// One paho client per MQTT session. The Transport owns at most one
// PahoSession at a time and recreates it on disconnect. Connection-lifecycle
// plumbing (signing, paho handshake) lives in the factory; per-message
// lifecycle lives in the PahoSession instance.

export interface PahoSessionMessage {
  topic: string;
  payload: string;
}

export interface PahoPublishHandle {
  // Opaque correlation id. The Transport uses it to match a publish() call
  // to the matching onDelivered notification.
  readonly id: number;
}

export interface DisconnectReason {
  code?: number;
  message: string;
}

export interface PahoSession {
  publish(message: PahoSessionMessage): PahoPublishHandle;
  onDelivered(handler: (id: number) => void): void;
  onDisconnect(handler: (reason: DisconnectReason) => void): void;
  destroy(): void;
}

export interface PahoSessionFactory {
  connect(): Promise<PahoSession>;
}

const CORRELATION_KEY = "__mqttPublisherId" as const;

type StampedMessage = Message & { [CORRELATION_KEY]?: number };

function connectPahoClient(url: string, clientId: string): Promise<Client> {
  const client = new Client(url, clientId);
  return new Promise<Client>((resolve, reject) => {
    client.connect({
      onSuccess: () => resolve(client),
      onFailure: (err) =>
        reject(new MqttError("Disconnected", err?.errorMessage ?? "paho connect failed")),
      useSSL: true,
      timeout: 10,
    });
  });
}

class PahoSessionImpl implements PahoSession {
  private nextId = 1;
  private deliveredHandler: ((id: number) => void) | null = null;
  private disconnectHandler: ((reason: DisconnectReason) => void) | null = null;
  private destroyed = false;

  constructor(private readonly client: Client) {
    client.onMessageDelivered = (message: Message) => {
      const id = (message as StampedMessage)[CORRELATION_KEY];
      if (typeof id === "number" && this.deliveredHandler) {
        this.deliveredHandler(id);
      }
    };

    client.onConnectionLost = (err) => {
      if (this.destroyed) return;
      if (this.disconnectHandler) {
        this.disconnectHandler({
          code: err?.errorCode,
          message: err?.errorMessage ?? "connection lost",
        });
      }
    };
  }

  publish(message: PahoSessionMessage): PahoPublishHandle {
    const id = this.nextId++;
    const pahoMessage = new Message(message.payload) as StampedMessage;
    pahoMessage.destinationName = message.topic;
    pahoMessage.qos = 1;
    pahoMessage[CORRELATION_KEY] = id;
    try {
      this.client.send(pahoMessage);
    } catch (err) {
      throw new MqttError("PublishError", "paho send failed", { cause: err });
    }
    return { id };
  }

  onDelivered(handler: (id: number) => void) {
    this.deliveredHandler = handler;
  }

  onDisconnect(handler: (reason: DisconnectReason) => void) {
    this.disconnectHandler = handler;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.client.disconnect();
    } catch {
      // paho throws if already disconnected — ignore.
    }
  }
}

export function createPahoSessionFactory(): PahoSessionFactory {
  return {
    async connect() {
      const t0 = Date.now();
      log.debug("connect: getCredentials start");
      const { accessKeyId, secretAccessKey, sessionToken } = await getCredentials({
        identityPoolId: getEnvVar("IDENTITY_POOL_ID"),
        region: getEnvVar("REGION"),
      }).catch((err) => {
        log.warn("getCredentials failed", { err: err?.message });
        throw new MqttError("CredentialError", "failed to fetch Cognito credentials", {
          cause: err,
        });
      });
      const tCreds = Date.now();

      const clientId = `${getEnvVar("CLIENT_ID")} - ${generateRandomString()}`;

      log.debug("connect: createSignedUrl start");
      const signedUrl = await createSignedUrl({
        clientId,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        region: getEnvVar("REGION"),
        endpoint: getEnvVar("IOT_ENDPOINT"),
      });
      const tSign = Date.now();

      log.debug("connect: paho connect start", { clientId });
      const client = await connectPahoClient(signedUrl, clientId);
      const tPaho = Date.now();
      log.info("connect done", {
        clientId,
        creds_ms: tCreds - t0,
        sign_ms: tSign - tCreds,
        paho_ms: tPaho - tSign,
        total_ms: tPaho - t0,
      });
      return new PahoSessionImpl(client);
    },
  };
}
