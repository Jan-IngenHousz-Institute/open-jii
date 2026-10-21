import type { BetterAuthPlugin } from "better-auth";

export const REGISTRATION_FIELD_ERROR = {
  code: "REGISTRATION_FIELD_FORBIDDEN",
  message: "Registration can only be completed by saving a profile.",
};

function containsRegistrationField(body: unknown): boolean {
  const pending = [body];
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== "object") continue;
    for (const [key, nested] of Object.entries(value)) {
      if (key === "registered") return true;
      pending.push(nested);
    }
  }
  return false;
}

export function serverOwnedRegistration() {
  return {
    id: "server-owned-registration",
    onRequest: async (request) => {
      if (!request.body) return;
      // Inspect before endpoint schemas can strip unknown fields, including future plugins.
      const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
      const body: unknown = await (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
          ? request.clone().formData().then(Object.fromEntries)
          : request.clone().json()
      ).catch(() => undefined);
      if (containsRegistrationField(body)) {
        return { response: Response.json(REGISTRATION_FIELD_ERROR, { status: 400 }) };
      }
    },
  } satisfies BetterAuthPlugin;
}
