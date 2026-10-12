import { render, screen } from "@/test/test-utils";
import { headers } from "next/headers";
import { describe, it, expect } from "vitest";

import initTranslations from "@repo/i18n/server";

import NotFound from "../not-found";

describe("NotFound", () => {
  it("renders 404 page with error messages and navigation links", async () => {
    render(await NotFound());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("errors.notFoundTitle");
    expect(screen.getByText("errors.notFoundHeading")).toBeInTheDocument();
    expect(screen.getByText("errors.goToHomepage")).toBeInTheDocument();
    expect(screen.getByText("errors.accessPlatform")).toBeInTheDocument();
    expect(screen.getByText("errors.learnAboutUs")).toBeInTheDocument();
  });

  it("speaks the default locale without reading the request", async () => {
    render(await NotFound());

    expect(initTranslations).toHaveBeenCalledWith({ locale: "en-US", namespaces: ["common"] });
    expect(headers).not.toHaveBeenCalled();
  });
});
