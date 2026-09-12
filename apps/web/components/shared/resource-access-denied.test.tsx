import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ResourceAccessDenied } from "./resource-access-denied";

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
