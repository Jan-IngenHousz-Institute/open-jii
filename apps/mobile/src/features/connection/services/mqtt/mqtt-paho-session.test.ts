import { beforeEach, describe, expect, it, vi } from "vitest";
import { MqttError } from "~/features/connection/services/mqtt/mqtt-errors";
import type { DisconnectReason } from "~/features/connection/services/mqtt/mqtt-paho-session";

// Hoisted mocks so they're in scope before module evaluation. The session
// module pulls in paho-mqtt + Cognito + env at top level; mocking them
// here keeps the test hermetic.
const { mockGetCredentials, mockCreateSignedUrl, mockGetEnvVar, mockGenerateRandomString } =
  vi.hoisted(() => ({
    mockGetCredentials: vi.fn(),
    mockCreateSignedUrl: vi.fn(),
    mockGetEnvVar: vi.fn((key: string) => `env-${key}`),
    mockGenerateRandomString: vi.fn(() => "rand-abc"),
  }));

// Track every paho Client constructed by the module under test so tests
// can drive its onSuccess / onFailure / onMessageDelivered / onConnectionLost.
interface ConnectArgs {
  onSuccess?: () => void;
  onFailure?: (err: { errorMessage?: string; errorCode?: number }) => void;
  useSSL?: boolean;
  timeout?: number;
}
class FakePahoClient {
  static instances: FakePahoClient[] = [];
  url: string;
  clientId: string;
  connectArgs: ConnectArgs | null = null;
  sent: FakePahoMessage[] = [];
  onMessageDelivered: ((m: FakePahoMessage) => void) | null = null;
  onConnectionLost:
    | ((err: { errorCode?: number; errorMessage?: string } | undefined) => void)
    | null = null;
  sendImpl: (m: FakePahoMessage) => void = () => undefined;
  disconnectImpl: () => void = () => undefined;
  disconnectCalls = 0;

  constructor(url: string, clientId: string) {
    this.url = url;
    this.clientId = clientId;
    FakePahoClient.instances.push(this);
  }

  connect(args: ConnectArgs) {
    this.connectArgs = args;
  }

  send(m: FakePahoMessage) {
    this.sendImpl(m);
    this.sent.push(m);
  }

  disconnect() {
    this.disconnectCalls++;
    this.disconnectImpl();
  }
}

class FakePahoMessage {
  payloadString: string;
  destinationName = "";
  qos = 0;
  // Arbitrary correlation key the session stamps on the message.
  [key: string]: unknown;

  constructor(payload: string) {
    this.payloadString = payload;
  }
}

vi.mock("paho-mqtt", () => ({
  Client: FakePahoClient,
  Message: FakePahoMessage,
}));
vi.mock("react-native-get-random-values", () => ({}));
vi.mock("~/shared/stores/environment-store", () => ({ getEnvVar: mockGetEnvVar }));
vi.mock("~/features/connection/utils/generate-random-string", () => ({
  generateRandomString: mockGenerateRandomString,
}));
vi.mock("~/features/connection/services/mqtt/aws-iot-auth", () => ({
  createSignedUrl: mockCreateSignedUrl,
  getCredentials: mockGetCredentials,
}));

// Import lazily so the mocks above are wired before the module evaluates.
async function loadModule() {
  return await import("~/features/connection/services/mqtt/mqtt-paho-session");
}

// Narrowing helper: asserts a possibly-undefined/null value is present and
// returns it typed as non-nullable, so tests can drive paho callbacks without
// non-null assertions.
function assertDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${label} to be defined`);
  }
  return value;
}

beforeEach(() => {
  FakePahoClient.instances = [];
  vi.clearAllMocks();
  mockGetEnvVar.mockImplementation((key: string) => `env-${key}`);
  mockGenerateRandomString.mockReturnValue("rand-abc");
  mockGetCredentials.mockResolvedValue({
    accessKeyId: "AKIA",
    secretAccessKey: "secret",
    sessionToken: "session",
  });
  mockCreateSignedUrl.mockResolvedValue("wss://broker.example/mqtt");
});

describe("createPahoSessionFactory", () => {
  describe("connect", () => {
    it("fetches credentials, signs a url, then connects paho — returning a live session", async () => {
      const { createPahoSessionFactory } = await loadModule();
      const factory = createPahoSessionFactory();
      const connecting = factory.connect();

      // The factory awaits getCredentials and createSignedUrl before
      // constructing the Client; once it does, paho is left waiting for
      // onSuccess. Drain microtasks until that happens.
      for (let i = 0; i < 20 && FakePahoClient.instances.length === 0; i++) {
        await Promise.resolve();
      }
      expect(mockGetCredentials).toHaveBeenCalledWith({
        identityPoolId: "env-IDENTITY_POOL_ID",
        region: "env-REGION",
      });
      expect(mockCreateSignedUrl).toHaveBeenCalledWith({
        clientId: "env-CLIENT_ID - rand-abc",
        accessKeyId: "AKIA",
        secretAccessKey: "secret",
        sessionToken: "session",
        region: "env-REGION",
        endpoint: "env-IOT_ENDPOINT",
      });
      const client = FakePahoClient.instances[0];
      expect(client.url).toBe("wss://broker.example/mqtt");
      expect(client.connectArgs?.useSSL).toBe(true);

      assertDefined(assertDefined(client.connectArgs, "connectArgs").onSuccess, "onSuccess")();
      const session = await connecting;
      expect(session).toBeDefined();
    });

    it("wraps getCredentials failures in a CredentialError", async () => {
      mockGetCredentials.mockRejectedValueOnce(new Error("cognito boom"));
      const { createPahoSessionFactory } = await loadModule();
      const factory = createPahoSessionFactory();

      await expect(factory.connect()).rejects.toMatchObject({
        kind: "CredentialError",
      });
      // paho was never reached.
      expect(FakePahoClient.instances).toHaveLength(0);
    });

    it("wraps paho onFailure callbacks as Disconnected MqttError", async () => {
      const { createPahoSessionFactory } = await loadModule();
      const factory = createPahoSessionFactory();
      const connecting = factory.connect();

      for (let i = 0; i < 20 && FakePahoClient.instances.length === 0; i++) {
        await Promise.resolve();
      }
      const client = FakePahoClient.instances[0];
      assertDefined(
        assertDefined(client.connectArgs, "connectArgs").onFailure,
        "onFailure",
      )({
        errorMessage: "handshake refused",
      });

      await expect(connecting).rejects.toMatchObject({
        kind: "Disconnected",
        message: "handshake refused",
      });
    });

    it("supplies a fallback message when paho omits errorMessage", async () => {
      const { createPahoSessionFactory } = await loadModule();
      const factory = createPahoSessionFactory();
      const connecting = factory.connect();
      for (let i = 0; i < 20 && FakePahoClient.instances.length === 0; i++) {
        await Promise.resolve();
      }
      assertDefined(
        assertDefined(FakePahoClient.instances[0].connectArgs, "connectArgs").onFailure,
        "onFailure",
      )({});

      await expect(connecting).rejects.toMatchObject({
        kind: "Disconnected",
        message: "paho connect failed",
      });
    });
  });

  // Helper: drive the factory to a live session and return it + the paho client.
  async function liveSession() {
    const { createPahoSessionFactory } = await loadModule();
    const factory = createPahoSessionFactory();
    const connecting = factory.connect();
    for (let i = 0; i < 20 && FakePahoClient.instances.length === 0; i++) {
      await Promise.resolve();
    }
    const client = FakePahoClient.instances[0];
    assertDefined(assertDefined(client.connectArgs, "connectArgs").onSuccess, "onSuccess")();
    const session = await connecting;
    return { session, client };
  }

  describe("publish", () => {
    it("hands a stamped Message with topic + qos=1 to paho and returns the correlation id", async () => {
      const { session, client } = await liveSession();
      const handle = session.publish({ topic: "exp/data", payload: '{"v":1}' });

      expect(client.sent).toHaveLength(1);
      expect(client.sent[0].destinationName).toBe("exp/data");
      expect(client.sent[0].qos).toBe(1);
      expect(client.sent[0].payloadString).toBe('{"v":1}');
      expect(typeof handle.id).toBe("number");
    });

    it("assigns sequential ids per publish so the transport can correlate PUBACKs", async () => {
      const { session } = await liveSession();
      const h1 = session.publish({ topic: "t", payload: "1" });
      const h2 = session.publish({ topic: "t", payload: "2" });
      const h3 = session.publish({ topic: "t", payload: "3" });
      const ids = [h1.id, h2.id, h3.id];
      expect(new Set(ids).size).toBe(3);
      // Strictly increasing — important so a late PUBACK can't accidentally
      // match a fresh publish that reused the id.
      expect(ids[1]).toBeGreaterThan(ids[0]);
      expect(ids[2]).toBeGreaterThan(ids[1]);
    });

    it("wraps paho send() throws as PublishError MqttError", async () => {
      const { session, client } = await liveSession();
      client.sendImpl = () => {
        throw new Error("queue overflow");
      };

      let thrown: unknown;
      try {
        session.publish({ topic: "t", payload: "x" });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(MqttError);
      expect((thrown as MqttError).kind).toBe("PublishError");
    });
  });

  describe("onDelivered", () => {
    it("fires the registered handler with the publish's correlation id", async () => {
      const { session, client } = await liveSession();
      const delivered = vi.fn();
      session.onDelivered(delivered);

      const handle = session.publish({ topic: "t", payload: "x" });
      // Simulate paho delivering the stamped message back via callback.
      assertDefined(client.onMessageDelivered, "onMessageDelivered")(client.sent[0]);

      expect(delivered).toHaveBeenCalledTimes(1);
      expect(delivered).toHaveBeenCalledWith(handle.id);
    });

    it("ignores delivered messages that lack the stamped correlation key", async () => {
      const { session, client } = await liveSession();
      const delivered = vi.fn();
      session.onDelivered(delivered);

      // A bare paho message (no correlation stamp) — e.g. from a subscribe
      // that the session doesn't own.
      const stranger = new FakePahoMessage("noise");
      assertDefined(client.onMessageDelivered, "onMessageDelivered")(stranger);

      expect(delivered).not.toHaveBeenCalled();
    });

    it("is a no-op when no handler has been registered", async () => {
      const { session, client } = await liveSession();
      // Publish so we have a stamped message in flight.
      session.publish({ topic: "t", payload: "x" });
      // No handler registered — the callback should not throw.
      expect(() =>
        assertDefined(client.onMessageDelivered, "onMessageDelivered")(client.sent[0]),
      ).not.toThrow();
    });
  });

  describe("onDisconnect", () => {
    it("fires with paho's code + message when the connection drops", async () => {
      const { session, client } = await liveSession();
      const onDisconnect = vi.fn();
      session.onDisconnect(onDisconnect);

      assertDefined(
        client.onConnectionLost,
        "onConnectionLost",
      )({
        errorCode: 7,
        errorMessage: "kicked",
      });

      expect(onDisconnect).toHaveBeenCalledWith({
        code: 7,
        message: "kicked",
      } satisfies DisconnectReason);
    });

    it("supplies a fallback message when paho omits errorMessage", async () => {
      const { session, client } = await liveSession();
      const onDisconnect = vi.fn();
      session.onDisconnect(onDisconnect);

      assertDefined(client.onConnectionLost, "onConnectionLost")(undefined);

      expect(onDisconnect).toHaveBeenCalledWith({
        code: undefined,
        message: "connection lost",
      });
    });

    it("suppresses disconnect events fired after destroy()", async () => {
      const { session, client } = await liveSession();
      const onDisconnect = vi.fn();
      session.onDisconnect(onDisconnect);

      session.destroy();
      assertDefined(client.onConnectionLost, "onConnectionLost")({ errorMessage: "post-destroy" });

      expect(onDisconnect).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("disconnects the paho client", async () => {
      const { session, client } = await liveSession();
      session.destroy();
      expect(client.disconnectCalls).toBe(1);
    });

    it("is idempotent — repeat calls do not re-disconnect", async () => {
      const { session, client } = await liveSession();
      session.destroy();
      session.destroy();
      session.destroy();
      expect(client.disconnectCalls).toBe(1);
    });

    it("swallows paho.disconnect() throws (already-disconnected case)", async () => {
      const { session, client } = await liveSession();
      client.disconnectImpl = () => {
        throw new Error("already disconnected");
      };
      expect(() => session.destroy()).not.toThrow();
    });
  });
});
