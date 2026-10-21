import { z } from "zod";

import inventory from "./guest-routes.json";

const routeSchema = z.object({
  procedure: z.string(),
  method: z.string(),
  path: z.string(),
  classification: z.enum([
    "deny",
    "public-list",
    "public-resource",
    "demo-upload",
    "demo-macro",
    "visit",
  ]),
  resource: z.enum(["experiment", "macro", "protocol", "workbook", "organization"]).optional(),
});

export const guestRouteInventory = z.array(routeSchema).parse(inventory);

// Static routes precede parameter routes, so /experiments/home isn't an experiment UUID.
const routes = [...guestRouteInventory].sort(
  (a, b) => (a.path.match(/\{/g)?.length ?? 0) - (b.path.match(/\{/g)?.length ?? 0),
);

export function matchGuestRoute(method: string, path: string) {
  const segments = path.replace(/\/+$/, "").split("/");
  for (const route of routes) {
    if (route.method !== method) continue;
    const template = route.path.split("/");
    if (template.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let matches = true;
    for (let i = 0; i < template.length; i++) {
      const part = template[i];
      if (part.startsWith("{") && part.endsWith("}")) {
        try {
          params[part.slice(1, -1)] = decodeURIComponent(segments[i]);
        } catch {
          matches = false;
          break;
        }
      } else if (part !== segments[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return { route, params };
  }
  return null;
}
