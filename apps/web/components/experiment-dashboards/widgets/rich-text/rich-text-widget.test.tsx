import { createRichTextWidget } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { RichTextWidgetView } from "./rich-text-widget";

describe("RichTextWidgetView", () => {
  it("renders the supplied HTML content", () => {
    const widget = createRichTextWidget({ config: { html: "<p>hello world</p>" } });
    render(<RichTextWidgetView widget={widget} />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("shows the empty state when html is an empty string", () => {
    const widget = createRichTextWidget({ config: { html: "" } });
    render(<RichTextWidgetView widget={widget} />);
    expect(screen.getByText("widget.emptyRichText")).toBeInTheDocument();
    expect(screen.getByText("widget.emptyRichTextDescription")).toBeInTheDocument();
  });

  it("shows the empty state for the Quill empty-paragraph sentinel", () => {
    const widget = createRichTextWidget({ config: { html: "<p><br></p>" } });
    render(<RichTextWidgetView widget={widget} />);
    expect(screen.getByText("widget.emptyRichText")).toBeInTheDocument();
  });

  it("treats whitespace-only html as empty", () => {
    const widget = createRichTextWidget({ config: { html: "   " } });
    render(<RichTextWidgetView widget={widget} />);
    expect(screen.getByText("widget.emptyRichText")).toBeInTheDocument();
  });
});
