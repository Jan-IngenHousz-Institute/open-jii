import { createSearchResult } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@repo/api/domains/search/search.schema";
import { Command, CommandList } from "@repo/ui/components/command";

import { SearchResultItem } from "./search-result-item";

function renderResult(result: SearchResult) {
  return render(
    <Command>
      <CommandList>
        <SearchResultItem result={result} onSelect={vi.fn()} />
      </CommandList>
    </Command>,
  );
}

describe("SearchResultItem translation namespaces", () => {
  it.each(["dashboard", "visualization"] as const)(
    "translates the %s experiment line from navigation",
    (type) => {
      const experimentTitle = `Canopy ${crypto.randomUUID()}`;
      renderResult(
        createSearchResult({
          type,
          id: crypto.randomUUID(),
          title: `Result ${crypto.randomUUID()}`,
          parent: { type: "experiment", id: crypto.randomUUID(), title: experimentTitle },
        }),
      );
      expect(screen.getByText(`in ${experimentTitle}`)).toBeInTheDocument();
      expect(screen.queryByText("commandPalette.result.inParent")).not.toBeInTheDocument();
    },
  );

  it("keeps organization type labels in the default namespace", () => {
    renderResult(
      createSearchResult({
        type: "organization",
        id: crypto.randomUUID(),
        title: `Institute ${crypto.randomUUID()}`,
        meta: "research_institute",
      }),
    );
    expect(screen.getByText("organizations.types.research_institute")).toBeInTheDocument();
  });
});

describe("SearchResultItem", () => {
  it("renders an unknown result type with its title and metadata", () => {
    renderResult(
      createSearchResult({
        type: "future_resource" as unknown as SearchResult["type"],
        title: "Future result",
        meta: "future metadata",
      }),
    );
    expect(screen.getByText("Future result")).toBeInTheDocument();
    expect(screen.getByText("Future metadata")).toBeInTheDocument();
  });
});
