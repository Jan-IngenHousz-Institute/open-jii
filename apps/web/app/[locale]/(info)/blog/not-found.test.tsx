import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import initTranslations from "@repo/i18n/server";

import NotFound from "./not-found";

describe("BlogNotFound", () => {
  it("renders not-found heading, description, and link home", async () => {
    render(await NotFound());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("notFound.title");
    expect(screen.getByText("notFound.description", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
    expect(screen.getByRole("link")).toHaveTextContent("common.description");
  });

  it("calls initTranslations with en-US locale", async () => {
    render(await NotFound());

    expect(initTranslations).toHaveBeenCalledWith({ locale: "en-US" });
  });
});
