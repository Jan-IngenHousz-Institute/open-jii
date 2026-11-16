export interface PersonLike {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  /** A name the server built, such as `displayName`, `createdByName` or `actor.name`. */
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

type NamedPerson = Pick<PersonLike, "firstName" | "lastName" | "displayName">;

export type NamePlacement = "row" | "text" | "byline";

export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The name the person has or the server built for them; never their email. */
export function ownName(
  person: Pick<PersonLike, "firstName" | "lastName" | "displayName">,
): string | undefined {
  const fullName = `${person.firstName?.trim() ?? ""} ${person.lastName?.trim() ?? ""}`.trim();
  return [fullName, person.displayName?.trim()].find(Boolean);
}

/**
 * The only way a person becomes text. Without a name of their own it falls back by
 * placement; never to their email or an id, and a pseudonym comes back as sent.
 */
export function personName(
  person: NamedPerson,
  t: Translate,
  options: { placement: "byline" },
): string | null;
export function personName(
  person: NamedPerson,
  t: Translate,
  options?: { placement?: "row" | "text" },
): string;
export function personName(
  person: NamedPerson,
  t: Translate,
  { placement = "row" }: { placement?: NamePlacement } = {},
): string | null {
  const name = ownName(person);
  if (name) return name;

  if (placement === "byline") return null;
  return placement === "text" ? t("notifications:someone") : t("common.unnamedAccount");
}
