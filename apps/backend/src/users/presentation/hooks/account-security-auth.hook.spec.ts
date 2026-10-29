import { Logger } from "@nestjs/common";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import { success } from "../../../common/utils/fp-utils";
import type { NotifyCredentialAddedUseCase } from "../../application/use-cases/notify-credential-added/notify-credential-added";
import { AccountSecurityAuthHook } from "./account-security-auth.hook";

const SECRET = "jii_s3cr3t-key-value";

/** What `/api-key/create` answers: the row, with the one-time secret under `key`. */
const API_KEY = {
  id: "key-1",
  name: "Field laptop",
  key: SECRET,
  start: "jii_s3",
  prefix: "jii_",
  referenceId: "owner-1",
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  expiresAt: null,
};

/** What `/passkey/verify-registration` answers: the passkey row. */
const PASSKEY = {
  id: "passkey-1",
  name: null,
  userId: "owner-1",
  credentialID: "credential-1",
  publicKey: "public-key",
  counter: 0,
  deviceType: "multiDevice",
  backedUp: true,
  transports: "internal",
  createdAt: new Date(),
  aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
};

function hookWith() {
  const execute = vi.fn().mockResolvedValue(success(undefined));
  const hook = new AccountSecurityAuthHook({ execute } as unknown as NotifyCredentialAddedUseCase);
  return { hook, execute };
}

/** What the adapter hands an after-hook: the endpoint's answer, whatever it was. */
const returning = (returned: unknown) => ({ context: { returned } }) as unknown as AuthHookContext;

describe("notifying about a new API key", () => {
  it("hands the use case the owner and the name, and nothing else", async () => {
    const { hook, execute } = hookWith();

    await hook.notifyApiKeyCreated(returning(API_KEY));

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      kind: "api_key",
      userId: "owner-1",
      name: "Field laptop",
    });
  });

  it("does nothing and does not throw when the create was refused", async () => {
    const { hook, execute } = hookWith();

    await expect(
      hook.notifyApiKeyCreated(
        returning(new APIError("BAD_REQUEST", { message: "Name is required" })),
      ),
    ).resolves.toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it("does nothing for an answer that is not a key row", async () => {
    const { hook, execute } = hookWith();

    await expect(
      hook.notifyApiKeyCreated(returning({ ...API_KEY, referenceId: undefined })),
    ).resolves.toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it("swallows a thrown fault without logging the key's secret", async () => {
    const { hook, execute } = hookWith();
    execute.mockRejectedValue(new Error("connection terminated"));
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await expect(hook.notifyApiKeyCreated(returning(API_KEY))).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-credential-added" }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET);
  });
});

describe("notifying about a new passkey", () => {
  it("hands the use case the owner, the missing name and the authenticator", async () => {
    const { hook, execute } = hookWith();

    await hook.notifyPasskeyAdded(returning(PASSKEY));

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      kind: "passkey",
      userId: "owner-1",
      name: null,
      aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
    });
  });

  it("reads an absent name and authenticator as none", async () => {
    const { hook, execute } = hookWith();
    const { name: _name, aaguid: _aaguid, ...withoutBoth } = PASSKEY;

    await hook.notifyPasskeyAdded(returning(withoutBoth));

    expect(execute).toHaveBeenCalledExactlyOnceWith({
      kind: "passkey",
      userId: "owner-1",
      name: null,
      aaguid: null,
    });
  });

  it("does nothing and does not throw when the registration was refused", async () => {
    const { hook, execute } = hookWith();

    await expect(
      hook.notifyPasskeyAdded(
        returning(new APIError("BAD_REQUEST", { message: "Failed to verify registration" })),
      ),
    ).resolves.toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it("does nothing for an answer that is not a passkey row", async () => {
    const { hook, execute } = hookWith();

    await expect(
      hook.notifyPasskeyAdded(returning({ ...PASSKEY, name: 42 })),
    ).resolves.toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it("swallows a thrown fault rather than 500ing a passkey that was written", async () => {
    const { hook, execute } = hookWith();
    execute.mockRejectedValue(new Error("connection terminated"));
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await expect(hook.notifyPasskeyAdded(returning(PASSKEY))).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-credential-added" }),
    );
  });
});
