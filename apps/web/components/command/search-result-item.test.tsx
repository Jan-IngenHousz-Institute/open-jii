import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@repo/api/domains/search/search.schema";
import { Command, CommandList } from "@repo/ui/components/command";

import { SearchResultItem } from "./search-result-item";

vi.mock("@repo/i18n", async () => {
  const { default: navigation } = await import("@repo/i18n/locales/en-US/navigation.json");
  const { default: common } = await import("@repo/i18n/locales/en-US/common.json");
  return {
    useTranslation: (namespace = "common") => ({
      t: (key: string, options?: Record<string, unknown>) => {
        if (namespace === "navigation" && key === "commandPalette.result.inParent") {
          return navigation.commandPalette.result.inParent.replace(
            "{{title}}",
            typeof options?.title === "string" ? options.title : "",
          );
        }
        if (namespace === "common" && key === "organizations.types.research_institute") {
          return common.organizations.types.research_institute;
        }
        return key;
      },
    }),
  };
});

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
      renderResult({
        type,
        id: crypto.randomUUID(),
        title: `Result ${crypto.randomUUID()}`,
        subtitle: null,
        meta: null,
        parent: { type: "experiment", id: crypto.randomUUID(), title: experimentTitle },
      });
      expect(screen.getByText(`in ${experimentTitle}`)).toBeInTheDocument();
      expect(screen.queryByText("commandPalette.result.inParent")).not.toBeInTheDocument();
    },
  );

  it("keeps organization type labels in the default namespace", () => {
    renderResult({
      type: "organization",
      id: crypto.randomUUID(),
      title: `Institute ${crypto.randomUUID()}`,
      subtitle: null,
      meta: "research_institute",
      parent: null,
    });
    expect(screen.getByText("Research institute")).toBeInTheDocument();
  });
});
