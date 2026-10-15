function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Strips other people's addresses from Better Auth organization responses. */
export function withoutOtherUsersEmails(value: unknown, selfId: string | null): unknown {
  if (Array.isArray(value)) return value.map((item) => withoutOtherUsersEmails(item, selfId));
  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    result[key] = withoutOtherUsersEmails(field, selfId);
  }
  const user = result.user;
  if (isPlainObject(user) && "email" in user && user.id !== selfId) {
    result.user = { ...user, email: null };
  }
  if ("inviterEmail" in result && result.inviterId !== selfId) {
    result.inviterEmail = null;
  }
  return result;
}
