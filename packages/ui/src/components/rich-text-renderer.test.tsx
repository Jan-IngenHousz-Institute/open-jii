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

    it("should apply custom className to plain text", () => {
      const plainText = "Plain text";
      const { container } = render(
        <RichTextRenderer content={plainText} className="custom-class" />,
      );
      const paragraph = container.querySelector("p");
      expect(paragraph).toHaveClass("custom-class");
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

    it("should apply custom className to rich text", () => {
      const richText = "<p>Rich text</p>";
      const { container } = render(
        <RichTextRenderer content={richText} className="custom-rich-class" />,
      );
      const editor = container.querySelector(".ql-editor");
      expect(editor).toHaveClass("custom-rich-class");
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
  });
});
