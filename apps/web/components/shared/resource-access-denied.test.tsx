import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import deCommon from "@repo/i18n/locales/de-DE/common.json";
import enCommon from "@repo/i18n/locales/en-US/common.json";
import nlCommon from "@repo/i18n/locales/nl-NL/common.json";

import { LIST_SEGMENTS, ResourceAccessDenied } from "./resource-access-denied";

describe("ResourceAccessDenied", () => {
  it("names the resource the viewer could not open", () => {
    render(<ResourceAccessDenied resource="device" />);

    expect(screen.getByText("errors.noAccess.title.device")).toBeInTheDocument();
    expect(screen.getByText("errors.noAccess.description")).toBeInTheDocument();
  });

  it("sends the viewer back to that resource's own list", () => {
    render(<ResourceAccessDenied resource="workbook" />);

    expect(screen.getByRole("link", { name: "errors.noAccess.back.workbook" })).toHaveAttribute(
      "href",
      "/en-US/platform/workbooks",
    );
  });

  it("routes a device group to the nested groups list", () => {
    render(<ResourceAccessDenied resource="device_group" />);

    expect(screen.getByRole("link", { name: "errors.noAccess.back.device_group" })).toHaveAttribute(
      "href",
      "/en-US/platform/devices/groups",
    );
  });

  it("returns resources that only exist inside an experiment to the experiment list", () => {
    render(<ResourceAccessDenied resource="dashboard" />);

    expect(screen.getByRole("link", { name: "errors.noAccess.back.dashboard" })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments",
    );
  });

  it("offers the request-access affordance when one was supplied", () => {
    render(
      <ResourceAccessDenied
        resource="experiment"
        requestAccess={<button type="button">request to join</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "request to join" })).toBeInTheDocument();
  });

  it("stays a dead end for no one: the list link survives without a request affordance", () => {
    render(<ResourceAccessDenied resource="macro" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "errors.noAccess.back.macro" })).toBeInTheDocument();
  });
});

describe("access-denied locale coverage", () => {
  /**
   * The component addresses both vocabularies through a template literal, so the
   * repo's literal-`t("…")` scan cannot see them. Sourced from the same map the
   * component indexes, so a new resource has to be given copy in all three
   * locales instead of shipping as a raw key on the page.
   */
  const resources = Object.keys(LIST_SEGMENTS);
  const bundles = { "en-US": enCommon, "de-DE": deCommon, "nl-NL": nlCommon };

  it.each(Object.keys(bundles))("%s names every resource it can deny", (locale) => {
    const noAccess = bundles[locale as keyof typeof bundles].errors.noAccess;

    const missing = resources.filter(
      (resource) =>
        !(resource in noAccess.title) ||
        !(resource in noAccess.back) ||
        noAccess.title[resource as keyof typeof noAccess.title] === "" ||
        noAccess.back[resource as keyof typeof noAccess.back] === "",
    );

    expect(missing).toEqual([]);
  });

  it.each(Object.keys(bundles))("%s carries no copy for a resource that is gone", (locale) => {
    const noAccess = bundles[locale as keyof typeof bundles].errors.noAccess;

    expect(Object.keys(noAccess.title).filter((key) => !resources.includes(key))).toEqual([]);
    expect(Object.keys(noAccess.back).filter((key) => !resources.includes(key))).toEqual([]);
  });
});
