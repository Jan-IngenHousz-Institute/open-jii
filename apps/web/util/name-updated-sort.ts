import { z } from "zod";

/**
 * The sort a list of one experiment's dashboards or charts accepts in its URL. Local, since
 * these lists hold every row at once and never send the sort to the API.
 */
export const zNameUpdatedSort = z
  .array(z.object({ field: z.enum(["name", "updatedAt"]), direction: z.enum(["asc", "desc"]) }))
  .max(2);

export type NameUpdatedSort = z.infer<typeof zNameUpdatedSort>;

interface NamedAndUpdated {
  name: string;
  updatedAt: string;
}

const compareField = (a: NamedAndUpdated, b: NamedAndUpdated, field: "name" | "updatedAt") =>
  field === "name"
    ? a.name.localeCompare(b.name)
    : Date.parse(a.updatedAt) - Date.parse(b.updatedAt);

/**
 * The rows in the order `sort` asks for, each field in turn, with the newest update first for
 * whatever the sort leaves tied. An empty sort is that default. Returns a new array.
 */
export function sortByNameAndUpdated<T extends NamedAndUpdated>(
  items: readonly T[],
  sort: NameUpdatedSort,
): T[] {
  return [...items].sort((a, b) => {
    for (const { field, direction } of sort) {
      const order = compareField(a, b, field);
      if (order !== 0) return direction === "asc" ? order : -order;
    }
    return -compareField(a, b, "updatedAt");
  });
}
