import { describe, expect, it } from "vitest";

import type {
  ColumnDescription,
  ColumnDictionary,
  DictionaryColumn,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";

import { DictionaryView } from "./dictionary-view";

const DESCRIPTION: ColumnDescription = {
  trait: "Leaf temperature",
  traitTerm: null,
  noTermFits: true,
  method: null,
  methodTerm: null,
  scale: null,
  scaleTerm: null,
  unit: null,
};

function column(identity: string, overrides: Partial<DictionaryColumn> = {}): DictionaryColumn {
  return {
    identity,
    name: identity,
    type: "DOUBLE",
    rowCount: 10,
    description: null,
    ...overrides,
  };
}

const dictionary: ColumnDictionary = {
  groups: [
    {
      producer: { kind: "instrument", workbookVersion: 5 },
      columns: [column("v5:a", { previous: "v4:a" }), column("v5:b")],
    },
    {
      producer: { kind: "instrument", workbookVersion: 4 },
      columns: [column("v4:a", { description: DESCRIPTION }), column("v4:b")],
    },
    { producer: { kind: "layout" }, columns: [column("layout:plot")] },
  ],
};

describe("DictionaryView", () => {
  const view = new DictionaryView(dictionary);

  it("counts the columns that need a description and leaves the layout's out", () => {
    expect(view.total).toBe(4);
    expect(view.described).toBe(1);
  });

  it("leaves the layout's column out of the undescribed filter", () => {
    const identities = view
      .visibleGroups("undescribed")
      .flatMap((group) => group.columns.map((item) => item.identity));

    expect(identities).toEqual(["v5:a", "v5:b", "v4:b"]);
  });

  it("offers the nearest earlier version's description for a column", () => {
    const entry = view.find("v5:a");

    expect(entry && view.earlierDescription(entry)).toEqual({
      description: DESCRIPTION,
      workbookVersion: 4,
    });
  });

  it("walks to the next column still to describe and wraps round", () => {
    const last = view.find("v4:b");
    const first = view.find("v5:a");

    expect(first && view.nextToDo(first, "undescribed")?.column.identity).toBe("v5:b");
    expect(last && view.nextToDo(last, "undescribed")?.column.identity).toBe("v5:a");
  });
});
