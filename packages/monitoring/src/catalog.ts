import yaml from "js-yaml";

import type { CatalogMetric, CatalogPass } from "./types.js";

interface CatalogDocument {
  passes?: CatalogPass[];
  metrics?: CatalogMetric[];
}

/**
 * The catalog is an in-repo file whose shape the consistency tests enforce, which is why
 * yaml's unknown is narrowed here by one assertion rather than by a runtime schema that
 * would ship in every Lambda bundle.
 */
function loadDocument(source: string): CatalogDocument {
  return (yaml.load(source) as CatalogDocument | undefined) ?? {};
}

export function parseCatalog(source: string): CatalogMetric[] {
  return loadDocument(source).metrics ?? [];
}

export function parsePasses(source: string): CatalogPass[] {
  return loadDocument(source).passes ?? [];
}
