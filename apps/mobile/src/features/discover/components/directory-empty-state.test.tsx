import { render, screen } from "@testing-library/react-native";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DirectoryEmptyState } from "./directory-empty-state";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "search.noResults": "No organizations match",
        empty: "No organizations yet",
      })[key] ?? key,
  }),
}));

describe("DirectoryEmptyState", () => {
  it("blames the term when there is one", () => {
    render(<DirectoryEmptyState hasSearchTerm />);

    expect(screen.getByText("No organizations match")).toBeTruthy();
    expect(screen.queryByText("No organizations yet")).toBeNull();
  });

  it("says the directory itself is empty when there is no term", () => {
    render(<DirectoryEmptyState hasSearchTerm={false} />);

    expect(screen.getByText("No organizations yet")).toBeTruthy();
    expect(screen.queryByText("No organizations match")).toBeNull();
  });
});
