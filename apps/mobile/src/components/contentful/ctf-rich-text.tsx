import type { Options } from "@contentful/rich-text-react-renderer";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document, Node } from "@contentful/rich-text-types";
import { BLOCKS, INLINES, MARKS } from "@contentful/rich-text-types";
import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

export interface CtfRichTextProps {
  json: Document;
  color?: string;
  inline?: boolean;
}

const makeInlineOptions = (color: string): Options => ({
  renderMark: {
    [MARKS.BOLD]: (text) => <Text style={{ color, fontWeight: "600" }}>{text}</Text>,
    [MARKS.ITALIC]: (text) => <Text style={{ color, fontStyle: "italic" }}>{text}</Text>,
    [MARKS.UNDERLINE]: (text) => (
      <Text style={{ color, textDecorationLine: "underline" }}>{text}</Text>
    ),
    [MARKS.CODE]: (text) => <Text style={{ color, fontFamily: "monospace" }}>{text}</Text>,
  },
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color }}>{children}</Text>
    ),
    [BLOCKS.HEADING_1]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color, fontWeight: "700" }}>{children}</Text>
    ),
    [BLOCKS.HEADING_2]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color, fontWeight: "700" }}>{children}</Text>
    ),
    [BLOCKS.HEADING_3]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color, fontWeight: "600" }}>{children}</Text>
    ),
    [BLOCKS.HEADING_4]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color, fontWeight: "600" }}>{children}</Text>
    ),
    [BLOCKS.HEADING_5]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color, fontWeight: "600" }}>{children}</Text>
    ),
    [BLOCKS.HEADING_6]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color, fontWeight: "600" }}>{children}</Text>
    ),
    [BLOCKS.UL_LIST]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color }}>{children}</Text>
    ),
    [BLOCKS.OL_LIST]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color }}>{children}</Text>
    ),
    [BLOCKS.LIST_ITEM]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color }}>
        {" • "}
        {children}
      </Text>
    ),
    [BLOCKS.QUOTE]: (_node: Node, children: React.ReactNode) => (
      <Text style={{ color, fontStyle: "italic" }}>{children}</Text>
    ),
    [BLOCKS.HR]: () => <Text style={{ color }}>{" — "}</Text>,
    [INLINES.HYPERLINK]: (node: Node, children: React.ReactNode) => {
      const uri = (node.data as { uri?: string }).uri ?? "#";
      return (
        <Text
          style={{ color, textDecorationLine: "underline" }}
          onPress={() => void Linking.openURL(uri)}
        >
          {children}
        </Text>
      );
    },
  },
});

const makeOptions = (color: string): Options => ({
  renderMark: {
    [MARKS.BOLD]: (text) => <Text style={[styles.base, { color, fontWeight: "600" }]}>{text}</Text>,
    [MARKS.ITALIC]: (text) => (
      <Text style={[styles.base, { color, fontStyle: "italic" }]}>{text}</Text>
    ),
    [MARKS.UNDERLINE]: (text) => (
      <Text style={[styles.base, { color, textDecorationLine: "underline" }]}>{text}</Text>
    ),
    [MARKS.CODE]: (text) => <Text style={[styles.base, styles.code, { color }]}>{text}</Text>,
  },
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node: Node, children: React.ReactNode) => (
      <Text style={[styles.paragraph, { color }]}>{children}</Text>
    ),
    [BLOCKS.HEADING_1]: (_node: Node, children: React.ReactNode) => (
      <Text style={[styles.h1, { color }]}>{children}</Text>
    ),
    [BLOCKS.HEADING_2]: (_node: Node, children: React.ReactNode) => (
      <Text style={[styles.h2, { color }]}>{children}</Text>
    ),
    [BLOCKS.HEADING_3]: (_node: Node, children: React.ReactNode) => (
      <Text style={[styles.h3, { color }]}>{children}</Text>
    ),
    [BLOCKS.HEADING_4]: (_node: Node, children: React.ReactNode) => (
      <Text style={[styles.h4, { color }]}>{children}</Text>
    ),
    [BLOCKS.HEADING_5]: (_node: Node, children: React.ReactNode) => (
      <Text style={[styles.h5, { color }]}>{children}</Text>
    ),
    [BLOCKS.HEADING_6]: (_node: Node, children: React.ReactNode) => (
      <Text style={[styles.h6, { color }]}>{children}</Text>
    ),
    [BLOCKS.UL_LIST]: (_node: Node, children: React.ReactNode) => (
      <View style={styles.list}>{children}</View>
    ),
    [BLOCKS.OL_LIST]: (_node: Node, children: React.ReactNode) => (
      <View style={styles.list}>{children}</View>
    ),
    [BLOCKS.LIST_ITEM]: (_node: Node, children: React.ReactNode) => (
      <View style={styles.listItem}>
        <Text style={[styles.bullet, { color }]}>{"•"}</Text>
        <View style={styles.listItemContent}>{children}</View>
      </View>
    ),
    [BLOCKS.QUOTE]: (_node: Node, children: React.ReactNode) => (
      <View style={styles.blockquote}>{children}</View>
    ),
    [BLOCKS.HR]: () => <View style={styles.hr} />,
    [BLOCKS.TABLE]: (_node: Node, children: React.ReactNode) => (
      <View style={styles.table}>{children}</View>
    ),
    [BLOCKS.TABLE_ROW]: (_node: Node, children: React.ReactNode) => (
      <View style={styles.tableRow}>{children}</View>
    ),
    [BLOCKS.TABLE_HEADER_CELL]: (_node: Node, children: React.ReactNode) => (
      <View style={[styles.tableCell, styles.tableHeaderCell]}>
        <Text style={[styles.base, { color, fontWeight: "600" }]}>{children}</Text>
      </View>
    ),
    [BLOCKS.TABLE_CELL]: (_node: Node, children: React.ReactNode) => (
      <View style={styles.tableCell}>
        <Text style={[styles.base, { color }]}>{children}</Text>
      </View>
    ),
    [INLINES.HYPERLINK]: (node: Node, children: React.ReactNode) => {
      const uri = (node.data as { uri?: string }).uri ?? "#";
      return (
        <Text
          style={[styles.base, { color, textDecorationLine: "underline" }]}
          onPress={() => void Linking.openURL(uri)}
        >
          {children}
        </Text>
      );
    },
  },
});

export function CtfRichText({ json, color = "#000000", inline = false }: CtfRichTextProps) {
  const options = inline ? makeInlineOptions(color) : makeOptions(color);
  return <>{documentToReactComponents(json, options)}</>;
}

const styles = StyleSheet.create({
  base: {
    fontSize: 14,
    lineHeight: 20,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  h1: { fontSize: 28, fontWeight: "700", marginBottom: 8, lineHeight: 34 },
  h2: { fontSize: 24, fontWeight: "600", marginBottom: 6, lineHeight: 30 },
  h3: { fontSize: 20, fontWeight: "600", marginBottom: 4, lineHeight: 26 },
  h4: { fontSize: 18, fontWeight: "600", marginBottom: 4, lineHeight: 24 },
  h5: { fontSize: 16, fontWeight: "600", marginBottom: 2, lineHeight: 22 },
  h6: { fontSize: 14, fontWeight: "600", marginBottom: 2, lineHeight: 20 },
  code: {
    fontFamily: "monospace",
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  list: { marginVertical: 4, gap: 2 },
  listItem: { flexDirection: "row", alignItems: "flex-start" },
  bullet: { marginRight: 6, fontSize: 14, lineHeight: 20 },
  listItemContent: { flex: 1 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(0,0,0,0.2)",
    paddingLeft: 12,
    marginVertical: 4,
    opacity: 0.8,
  },
  hr: { height: 1, backgroundColor: "rgba(0,0,0,0.1)", marginVertical: 8 },
  table: { borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", marginVertical: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  tableCell: { flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: "rgba(0,0,0,0.1)" },
  tableHeaderCell: { backgroundColor: "rgba(0,0,0,0.04)" },
});
