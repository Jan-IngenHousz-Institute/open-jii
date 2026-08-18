/**
 * A device reports the ids it published under, which is not the same as the
 * viewer being allowed to see what those ids are. Anything the viewer's own
 * accessible list contains resolves to its name (and a link); anything else
 * stays deliberately opaque, numbered per surface so the rows remain
 * distinguishable without disclosing an id the viewer has no access to.
 */
export interface ResolvedEntity {
  id: string;
  label: string;
  /** Null when the viewer cannot see the entity, so nothing links out. */
  href: string | null;
  accessible: boolean;
}

export interface EntityAccess {
  id: string;
  name: string;
}

export function resolveEntities(
  ids: string[],
  accessible: EntityAccess[],
  buildHref: (id: string) => string,
  privateLabel: (index: number) => string,
): Map<string, ResolvedEntity> {
  const byId = new Map(accessible.map((entity) => [entity.id, entity.name]));
  const resolved = new Map<string, ResolvedEntity>();
  let privateCount = 0;

  for (const id of ids) {
    if (resolved.has(id)) {
      continue;
    }

    const name = byId.get(id);
    if (name === undefined) {
      privateCount += 1;
      resolved.set(id, {
        id,
        label: privateLabel(privateCount),
        href: null,
        accessible: false,
      });
      continue;
    }

    resolved.set(id, { id, label: name, href: buildHref(id), accessible: true });
  }

  return resolved;
}
