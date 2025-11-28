import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { RichTextRenderer } from "./rich-text-renderer";

describe("RichTextRenderer", () => {
  describe("Empty or null content", () => {
    it("should render fallback message when content is empty", () => {
      render(<RichTextRenderer content="" />);
      expect(screen.getByText("No description provided")).toBeInTheDocument();
    });

    it("should render fallback message when content is only empty paragraph", () => {
      render(<RichTextRenderer content="<p><br></p>" />);
      expect(screen.getByText("No description provided")).toBeInTheDocument();
    });

    it("should have italic styling on fallback message", () => {
      render(<RichTextRenderer content="" />);
      const fallback = screen.getByText("No description provided");
      expect(fallback).toHaveClass("text-muted-foreground", "text-sm", "italic");
    });
  });

  describe("Plain text content", () => {
    it("should render plain text without rich text formatting", () => {
      const plainText = "This is just plain text";
      render(<RichTextRenderer content={plainText} />);
      expect(screen.getByText(plainText)).toBeInTheDocument();
    });

    it("should wrap plain text in a paragraph", () => {
      const plainText = "This is just plain text";
      const { container } = render(<RichTextRenderer content={plainText} />);
      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
      expect(paragraph).toHaveClass("text-sm");
    });

    it("should not add ql-editor class for plain text", () => {
      const plainText = "This is just plain text";
      const { container } = render(<RichTextRenderer content={plainText} />);
      expect(container.querySelector(".ql-editor")).not.toBeInTheDocument();
    });
  });

  describe("Rich text content", () => {
    it("should render content with <p> tags as rich text", () => {
      const richText = "<p>This is a paragraph</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      expect(container.querySelector(".ql-editor")).toBeInTheDocument();
    });

    it("should render content with <strong> tags as rich text", () => {
      const richText = "<strong>Bold text</strong>";
      const { container } = render(<RichTextRenderer content={richText} />);
      expect(container.querySelector(".ql-editor")).toBeInTheDocument();
    });

    it("should render content with <em> tags as rich text", () => {
      const richText = "<em>Italic text</em>";
      const { container } = render(<RichTextRenderer content={richText} />);
      expect(container.querySelector(".ql-editor")).toBeInTheDocument();
    });

    it("should render content with <ul> tags as rich text", () => {
      const richText = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const { container } = render(<RichTextRenderer content={richText} />);
      expect(container.querySelector(".ql-editor")).toBeInTheDocument();
    });

    it("should render content with <ol> tags as rich text", () => {
      const richText = "<ol><li>Item 1</li><li>Item 2</li></ol>";
      const { container } = render(<RichTextRenderer content={richText} />);
      expect(container.querySelector(".ql-editor")).toBeInTheDocument();
    });

    it("should render content with heading tags as rich text", () => {
      const richText = "<h1>Heading 1</h1><h2>Heading 2</h2>";
      const { container } = render(<RichTextRenderer content={richText} />);
      expect(container.querySelector(".ql-editor")).toBeInTheDocument();
    });

    it("should render content with <br> tags as rich text", () => {
      const richText = "Line 1<br>Line 2";
      const { container } = render(<RichTextRenderer content={richText} />);
      expect(container.querySelector(".ql-editor")).toBeInTheDocument();
    });

    it("should render HTML content using dangerouslySetInnerHTML", () => {
      const richText = "<p><strong>Bold</strong> and <em>italic</em> text</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor?.innerHTML).toContain("<strong>Bold</strong>");
      expect(editor?.innerHTML).toContain("<em>italic</em>");
    });
  });

  describe("Truncation functionality", () => {
    it("should not apply truncation by default", () => {
      const richText = "<p>This is a long paragraph</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor).not.toHaveClass("rich-text-renderer-truncate");
    });

    it("should apply truncation class when truncate is true", () => {
      const richText = "<p>This is a long paragraph</p>";
      const { container } = render(<RichTextRenderer content={richText} truncate={true} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor).toHaveClass("rich-text-renderer-truncate");
    });

    it("should apply default maxLines of 2 when truncate is true", () => {
      const richText = "<p>This is a long paragraph</p>";
      const { container } = render(<RichTextRenderer content={richText} truncate={true} />);
      const editor = container.querySelector(".ql-editor") as HTMLElement;
      expect(editor).toHaveClass("rich-text-renderer-truncate");
      expect(editor).toBeInTheDocument();
    });

    it("should apply custom maxLines when provided", () => {
      const richText = "<p>This is a long paragraph</p>";
      const { container } = render(
        <RichTextRenderer content={richText} truncate={true} maxLines={5} />,
      );
      const editor = container.querySelector(".ql-editor") as HTMLElement;
      expect(editor).toHaveClass("rich-text-renderer-truncate");
      expect(editor).toBeInTheDocument();
    });

    it("should not apply line clamp style when truncate is false", () => {
      const richText = "<p>This is a long paragraph</p>";
      const { container } = render(
        <RichTextRenderer content={richText} truncate={false} maxLines={5} />,
      );
      const editor = container.querySelector(".ql-editor") as HTMLElement;
      expect(editor).not.toHaveClass("rich-text-renderer-truncate");
    });
  });

  describe("CSS classes and styling", () => {
    it("should apply base rich-text-renderer class", () => {
      const richText = "<p>Test content</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".rich-text-renderer");
      expect(editor).toBeInTheDocument();
    });

    it("should apply ql-editor class for rich text", () => {
      const richText = "<p>Test content</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor).toBeInTheDocument();
    });

    it("should include inline styles in the document", () => {
      const richText = "<p>Test content</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const styleElement = container.querySelector("style");
      expect(styleElement).toBeInTheDocument();
      expect(styleElement?.innerHTML).toContain(".rich-text-renderer");
    });

    it("should include truncation styles when truncate is enabled", () => {
      const richText = "<p>Test content</p>";
      const { container } = render(<RichTextRenderer content={richText} truncate={true} />);
      const styleElement = container.querySelector("style");
      expect(styleElement?.innerHTML).toContain(".rich-text-renderer-truncate");
      expect(styleElement?.innerHTML).toContain("-webkit-box-orient: vertical");
    });
  });

  describe("Complex rich text scenarios", () => {
    it("should render mixed formatting correctly", () => {
      const richText = `
        <h1>Title</h1>
        <p>This is a <strong>bold</strong> and <em>italic</em> paragraph.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor?.innerHTML).toContain("<h1>Title</h1>");
      expect(editor?.innerHTML).toContain("<strong>bold</strong>");
      expect(editor?.innerHTML).toContain("<em>italic</em>");
      expect(editor?.innerHTML).toContain("<ul>");
    });

    it("should render multiple paragraphs", () => {
      const richText = "<p>First paragraph</p><p>Second paragraph</p><p>Third paragraph</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor?.innerHTML).toContain("First paragraph");
      expect(editor?.innerHTML).toContain("Second paragraph");
      expect(editor?.innerHTML).toContain("Third paragraph");
    });

    it("should render nested lists", () => {
      const richText = `
        <ul>
          <li>Parent item
            <ul>
              <li>Child item</li>
            </ul>
          </li>
        </ul>
      `;
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor?.innerHTML).toContain("Parent item");
      expect(editor?.innerHTML).toContain("Child item");
    });

    it("should handle code blocks in content", () => {
      const richText = "<p>Here is some <code>inline code</code> in text.</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor?.innerHTML).toContain("<code>inline code</code>");
    });

    it("should handle links in content", () => {
      const richText = '<p>Visit <a href="https://example.com">this link</a> for more info.</p>';
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor?.innerHTML).toContain('<a href="https://example.com">');
    });

    it("should handle blockquotes in content", () => {
      const richText = "<p><blockquote>This is a quote</blockquote></p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor).toBeInTheDocument();
      expect(editor?.innerHTML).toContain("This is a quote");
    });
  });

  describe("Edge cases", () => {
    it("should handle content with only whitespace as plain text", () => {
      const whitespaceText = "   \n   \t   ";
      const { container } = render(<RichTextRenderer content={whitespaceText} />);
      expect(container.querySelector(".ql-editor")).not.toBeInTheDocument();
    });

    it("should handle very long content", () => {
      const longText = "<p>" + "word ".repeat(1000) + "</p>";
      const { container } = render(<RichTextRenderer content={longText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor).toBeInTheDocument();
    });

    it("should handle special HTML characters", () => {
      const richText = "<p>&lt;div&gt; &amp; &quot;quotes&quot;</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor?.innerHTML).toContain("&lt;div&gt;");
      expect(editor?.innerHTML).toContain("&amp;");
    });

    it("should handle content with multiple heading levels", () => {
      const richText = "<h1>H1</h1><h2>H2</h2><h3>H3</h3>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor?.innerHTML).toContain("<h1>H1</h1>");
      expect(editor?.innerHTML).toContain("<h2>H2</h2>");
      expect(editor?.innerHTML).toContain("<h3>H3</h3>");
    });
  });

  describe("Props validation", () => {
    it("should accept all valid props", () => {
      const richText = "<p>Test content</p>";
      const { container } = render(
        <RichTextRenderer content={richText} truncate={true} maxLines={3} />,
      );
      expect(container.querySelector(".ql-editor")).toBeInTheDocument();
    });

    it("should work with maxLines without truncate prop (no effect)", () => {
      const richText = "<p>Test content</p>";
      const { container } = render(<RichTextRenderer content={richText} maxLines={5} />);
      const editor = container.querySelector(".ql-editor") as HTMLElement;
      expect(editor).not.toHaveClass("rich-text-renderer-truncate");
    });

    it("should default truncate to false", () => {
      const richText = "<p>Test content</p>";
      const { container } = render(<RichTextRenderer content={richText} />);
      const editor = container.querySelector(".ql-editor");
      expect(editor).not.toHaveClass("rich-text-renderer-truncate");
    });

    it("should default maxLines to 2", () => {
      const richText = "<p>Test content</p>";
      const { container } = render(<RichTextRenderer content={richText} truncate={true} />);
      const editor = container.querySelector(".ql-editor") as HTMLElement;
      expect(editor).toHaveClass("rich-text-renderer-truncate");
    });
  });
});
