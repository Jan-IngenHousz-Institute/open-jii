import type { StatusComponent, StatusDocument } from "@repo/monitoring/status-document";

export function componentOf(document: StatusDocument, id: StatusComponent["id"]) {
  const found = document.components.find((component) => component.id === id);
  if (found === undefined) {
    throw new Error(`no ${id} component in the fixture`);
  }

  return found;
}
