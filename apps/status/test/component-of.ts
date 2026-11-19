import type { StatusComponent, StatusDocument } from "@repo/monitoring/status-document";

export function componentOf(document: StatusDocument, id: StatusComponent["id"]) {
  const found = document.components.find((component) => component.id === id);
  if (found === undefined) {
    throw new Error(`no ${id} component in the fixture`);
  }

  return found;
}

/** The document's components without one, as a document from before its checks began holds them. */
export function componentsWithout(document: StatusDocument, id: StatusComponent["id"]) {
  return document.components.filter((component) => component.id !== id);
}
