interface PersonAttribution {
  firstName?: string;
  lastName?: string;
  isGuest?: boolean;
  isFormerGuest?: boolean;
}

type TranslateName = (key: string, options: { context: string; name: string }) => string;

export function personDisplayName(
  person: PersonAttribution,
  t: TranslateName,
  fallback = "",
): string {
  const name = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || fallback;
  if (!person.isGuest && !person.isFormerGuest) return name;
  let kind = "guest";
  if (!name || name === "Guest") kind = "unnamedGuest";
  if (person.isFormerGuest) kind = "formerGuest";
  return t("members.displayName", { context: kind, name });
}
