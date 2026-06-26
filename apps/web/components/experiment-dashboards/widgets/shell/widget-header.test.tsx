import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { WidgetHeader } from "./widget-header";

describe("WidgetHeader", () => {
  it("renders title and description when both are present", () => {
    render(<WidgetHeader title="Hello" description="World" />);
    expect(screen.getByRole("heading", { name: "Hello" })).toBeInTheDocument();
    expect(screen.getByText("World")).toBeInTheDocument();
  });

  it("renders nothing when title, description, and trailing are all empty", () => {
    const { container } = render(<WidgetHeader title="" description={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores whitespace-only title and description", () => {
    const { container } = render(<WidgetHeader title="   " description="  " />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders trailing content even when title and description are missing", () => {
    render(<WidgetHeader trailing={<span>tail</span>} />);
    expect(screen.getByText("tail")).toBeInTheDocument();
  });

  it("renders only the description when no title is set", () => {
    render(<WidgetHeader title={null} description="just a description" />);
    expect(screen.getByText("just a description")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
