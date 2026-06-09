import { BLOCKS, INLINES, MARKS } from "@contentful/rich-text-types";
import type { Document } from "@contentful/rich-text-types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { CtfRichText } from "./ctf-rich-text";

// Minimal builders for Contentful rich-text nodes — enough to exercise the
// renderers without pulling in the full type machinery.
type RtNode = Record<string, unknown>;

const text = (value: string, marks: MARKS[] = []): RtNode => ({
  nodeType: "text",
  value,
  marks: marks.map((type) => ({ type })),
  data: {},
});

const block = (nodeType: BLOCKS, ...content: RtNode[]): RtNode => ({ nodeType, data: {}, content });

const hyperlink = (uri: string, ...content: RtNode[]): RtNode => ({
  nodeType: INLINES.HYPERLINK,
  data: { uri },
  content,
});

const doc = (...content: RtNode[]): Document =>
  ({ nodeType: BLOCKS.DOCUMENT, data: {}, content }) as unknown as Document;

describe("CtfRichText", () => {
  it("renders paragraph text", () => {
    render(<CtfRichText json={doc(block(BLOCKS.PARAGRAPH, text("Hello world")))} />);

    expect(screen.getByText("Hello world")).toBeTruthy();
  });

  it("renders all text marks", () => {
    render(
      <CtfRichText
        json={doc(
          block(BLOCKS.PARAGRAPH, text("bolded", [MARKS.BOLD])),
          block(BLOCKS.PARAGRAPH, text("italicised", [MARKS.ITALIC])),
          block(BLOCKS.PARAGRAPH, text("underlined", [MARKS.UNDERLINE])),
          block(BLOCKS.PARAGRAPH, text("coded", [MARKS.CODE])),
        )}
      />,
    );

    expect(screen.getByText("bolded")).toBeTruthy();
    expect(screen.getByText("italicised")).toBeTruthy();
    expect(screen.getByText("underlined")).toBeTruthy();
    expect(screen.getByText("coded")).toBeTruthy();
  });

  it("numbers ordered list items", () => {
    render(
      <CtfRichText
        json={doc(
          block(
            BLOCKS.OL_LIST,
            block(BLOCKS.LIST_ITEM, block(BLOCKS.PARAGRAPH, text("First"))),
            block(BLOCKS.LIST_ITEM, block(BLOCKS.PARAGRAPH, text("Second"))),
          ),
        )}
      />,
    );

    expect(screen.getByText("1.")).toBeTruthy();
    expect(screen.getByText("2.")).toBeTruthy();
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("bullets unordered list items", () => {
    render(
      <CtfRichText
        json={doc(
          block(BLOCKS.UL_LIST, block(BLOCKS.LIST_ITEM, block(BLOCKS.PARAGRAPH, text("Alpha")))),
        )}
      />,
    );

    expect(screen.getByText("•")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("opens a hyperlink's url when tapped", () => {
    const openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(true);

    render(
      <CtfRichText
        json={doc(block(BLOCKS.PARAGRAPH, hyperlink("https://example.com", text("Read more"))))}
      />,
    );

    fireEvent.press(screen.getByText("Read more"));

    expect(openURL).toHaveBeenCalledWith("https://example.com");
  });

  it("renders headings and blockquotes", () => {
    render(
      <CtfRichText
        json={doc(
          block(BLOCKS.HEADING_1, text("Title")),
          block(BLOCKS.QUOTE, block(BLOCKS.PARAGRAPH, text("Quoted line"))),
        )}
      />,
    );

    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Quoted line")).toBeTruthy();
  });

  it("renders inline variant text", () => {
    render(<CtfRichText inline json={doc(block(BLOCKS.PARAGRAPH, text("inline copy")))} />);

    expect(screen.getByText("inline copy")).toBeTruthy();
  });
});
