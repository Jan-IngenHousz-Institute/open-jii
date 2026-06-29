import { BLOCKS, INLINES, MARKS } from "@contentful/rich-text-types";
import type { Document } from "@contentful/rich-text-types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEnvVar } from "~/shared/stores/environment-store";

import { CtfRichText } from "./ctf-rich-text";

vi.mock("~/shared/stores/environment-store", () => ({ getEnvVar: vi.fn() }));
const mockedGetEnvVar = vi.mocked(getEnvVar);

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("renders the full inline node set", () => {
    const openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(true);

    render(
      <CtfRichText
        inline
        json={doc(
          block(BLOCKS.HEADING_1, text("inline h1")),
          block(BLOCKS.HEADING_2, text("inline h2")),
          block(BLOCKS.HEADING_3, text("inline h3")),
          block(BLOCKS.HEADING_4, text("inline h4")),
          block(BLOCKS.HEADING_5, text("inline h5")),
          block(BLOCKS.HEADING_6, text("inline h6")),
          block(
            BLOCKS.PARAGRAPH,
            text("b", [MARKS.BOLD]),
            text("i", [MARKS.ITALIC]),
            text("u", [MARKS.UNDERLINE]),
            text("c", [MARKS.CODE]),
            hyperlink("https://inline.test", text("inline link")),
          ),
          block(BLOCKS.UL_LIST, block(BLOCKS.LIST_ITEM, block(BLOCKS.PARAGRAPH, text("ul item")))),
          block(BLOCKS.OL_LIST, block(BLOCKS.LIST_ITEM, block(BLOCKS.PARAGRAPH, text("ol item")))),
          block(BLOCKS.QUOTE, block(BLOCKS.PARAGRAPH, text("inline quote"))),
          block(BLOCKS.HR),
        )}
      />,
    );

    expect(screen.getByText("inline h1")).toBeTruthy();
    expect(screen.getByText("inline h6")).toBeTruthy();
    expect(screen.getByText("ul item")).toBeTruthy();
    expect(screen.getByText("ol item")).toBeTruthy();
    expect(screen.getByText("inline quote")).toBeTruthy();

    fireEvent.press(screen.getByText("inline link"));
    expect(openURL).toHaveBeenCalledWith("https://inline.test");
  });

  it("renders headings, a table, and a divider", () => {
    render(
      <CtfRichText
        json={doc(
          block(BLOCKS.HEADING_2, text("Heading 2")),
          block(BLOCKS.HEADING_3, text("Heading 3")),
          block(BLOCKS.HEADING_4, text("Heading 4")),
          block(BLOCKS.HEADING_5, text("Heading 5")),
          block(BLOCKS.HEADING_6, text("Heading 6")),
          block(BLOCKS.HR),
          block(
            BLOCKS.TABLE,
            block(
              BLOCKS.TABLE_ROW,
              block(BLOCKS.TABLE_HEADER_CELL, block(BLOCKS.PARAGRAPH, text("Header cell"))),
              block(BLOCKS.TABLE_CELL, block(BLOCKS.PARAGRAPH, text("Body cell"))),
            ),
          ),
        )}
      />,
    );

    expect(screen.getByText("Heading 2")).toBeTruthy();
    expect(screen.getByText("Heading 6")).toBeTruthy();
    expect(screen.getByText("Header cell")).toBeTruthy();
    expect(screen.getByText("Body cell")).toBeTruthy();
  });

  it("resolves a site-relative hyperlink against the web base url", () => {
    mockedGetEnvVar.mockReturnValue("https://app.openjii.org");
    const openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(true);

    render(<CtfRichText json={doc(block(BLOCKS.PARAGRAPH, hyperlink("/about", text("About"))))} />);
    fireEvent.press(screen.getByText("About"));

    expect(mockedGetEnvVar).toHaveBeenCalledWith("NEXT_AUTH_URI", false);
    expect(openURL).toHaveBeenCalledWith("https://app.openjii.org/about");
  });

  it("drops a site-relative hyperlink without crashing when the base url is unavailable", () => {
    mockedGetEnvVar.mockImplementation(() => {
      throw new Error("Env variable NEXT_AUTH_URI is required");
    });
    const openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(true);

    render(<CtfRichText json={doc(block(BLOCKS.PARAGRAPH, hyperlink("/about", text("About"))))} />);

    expect(() => fireEvent.press(screen.getByText("About"))).not.toThrow();
    expect(openURL).not.toHaveBeenCalled();
  });

  it("handles a rejected openURL without throwing", async () => {
    const openURL = vi.spyOn(Linking, "openURL").mockRejectedValue(new Error("No Activity found"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <CtfRichText
        json={doc(block(BLOCKS.PARAGRAPH, hyperlink("https://example.com", text("Read more"))))}
      />,
    );

    expect(() => fireEvent.press(screen.getByText("Read more"))).not.toThrow();
    expect(openURL).toHaveBeenCalledWith("https://example.com");
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});
