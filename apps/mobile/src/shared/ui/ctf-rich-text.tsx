import type { Options } from "@contentful/rich-text-react-renderer";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document, Node } from "@contentful/rich-text-types";
import { BLOCKS, INLINES, MARKS } from "@contentful/rich-text-types";
import React from "react";
import { Linking, Text, View } from "react-native";

export interface CtfRichTextProps {
  json: Document;
  textClass?: string;
  inline?: boolean;
}

const makeInlineOptions = (textClass: string): Options => ({
  renderMark: {
    [MARKS.BOLD]: (text) => <Text className={`${textClass} font-semibold`}>{text}</Text>,
    [MARKS.ITALIC]: (text) => <Text className={`${textClass} italic`}>{text}</Text>,
    [MARKS.UNDERLINE]: (text) => <Text className={`${textClass} underline`}>{text}</Text>,
    [MARKS.CODE]: (text) => <Text className={`${textClass} font-mono`}>{text}</Text>,
  },
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node: Node, children: React.ReactNode) => (
      <Text className={textClass}>{children}</Text>
    ),
    [BLOCKS.HEADING_1]: (_node: Node, children: React.ReactNode) => (
      <Text className={`${textClass} font-bold`}>{children}</Text>
    ),
    [BLOCKS.HEADING_2]: (_node: Node, children: React.ReactNode) => (
      <Text className={`${textClass} font-bold`}>{children}</Text>
    ),
    [BLOCKS.HEADING_3]: (_node: Node, children: React.ReactNode) => (
      <Text className={`${textClass} font-semibold`}>{children}</Text>
    ),
    [BLOCKS.HEADING_4]: (_node: Node, children: React.ReactNode) => (
      <Text className={`${textClass} font-semibold`}>{children}</Text>
    ),
    [BLOCKS.HEADING_5]: (_node: Node, children: React.ReactNode) => (
      <Text className={`${textClass} font-semibold`}>{children}</Text>
    ),
    [BLOCKS.HEADING_6]: (_node: Node, children: React.ReactNode) => (
      <Text className={`${textClass} font-semibold`}>{children}</Text>
    ),
    [BLOCKS.UL_LIST]: (_node: Node, children: React.ReactNode) => (
      <Text className={textClass}>{children}</Text>
    ),
    [BLOCKS.OL_LIST]: (_node: Node, children: React.ReactNode) => (
      <Text className={textClass}>{children}</Text>
    ),
    [BLOCKS.LIST_ITEM]: (_node: Node, children: React.ReactNode) => (
      <Text className={textClass}>
        {" • "}
        {children}
      </Text>
    ),
    [BLOCKS.QUOTE]: (_node: Node, children: React.ReactNode) => (
      <Text className={`${textClass} italic`}>{children}</Text>
    ),
    [BLOCKS.HR]: () => <Text className={textClass}>{" — "}</Text>,
    [INLINES.HYPERLINK]: (node: Node, children: React.ReactNode) => {
      const uri = (node.data as { uri?: string }).uri;
      if (!uri) return null;
      return (
        <Text className={`${textClass} underline`} onPress={() => void Linking.openURL(uri)}>
          {children}
        </Text>
      );
    },
  },
});

const makeOptions = (textClass: string): Options => ({
  renderMark: {
    [MARKS.BOLD]: (text) => (
      <Text className={`text-sm font-semibold leading-5 ${textClass}`}>{text}</Text>
    ),
    [MARKS.ITALIC]: (text) => (
      <Text className={`text-sm italic leading-5 ${textClass}`}>{text}</Text>
    ),
    [MARKS.UNDERLINE]: (text) => (
      <Text className={`text-sm leading-5 underline ${textClass}`}>{text}</Text>
    ),
    [MARKS.CODE]: (text) => (
      <Text className={`rounded-[3px] bg-black/[6%] px-1 font-mono text-sm leading-5 ${textClass}`}>
        {text}
      </Text>
    ),
  },
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node: Node, children: React.ReactNode) => (
      <Text className={`mb-1 text-sm leading-5 ${textClass}`}>{children}</Text>
    ),
    [BLOCKS.HEADING_1]: (_node: Node, children: React.ReactNode) => (
      <Text className={`mb-2 text-[28px] font-bold leading-[34px] ${textClass}`}>{children}</Text>
    ),
    [BLOCKS.HEADING_2]: (_node: Node, children: React.ReactNode) => (
      <Text className={`mb-1.5 text-2xl font-semibold leading-[30px] ${textClass}`}>
        {children}
      </Text>
    ),
    [BLOCKS.HEADING_3]: (_node: Node, children: React.ReactNode) => (
      <Text className={`mb-1 text-xl font-semibold leading-[26px] ${textClass}`}>{children}</Text>
    ),
    [BLOCKS.HEADING_4]: (_node: Node, children: React.ReactNode) => (
      <Text className={`mb-1 text-lg font-semibold leading-6 ${textClass}`}>{children}</Text>
    ),
    [BLOCKS.HEADING_5]: (_node: Node, children: React.ReactNode) => (
      <Text className={`mb-0.5 text-base font-semibold leading-[22px] ${textClass}`}>
        {children}
      </Text>
    ),
    [BLOCKS.HEADING_6]: (_node: Node, children: React.ReactNode) => (
      <Text className={`mb-0.5 text-sm font-semibold leading-5 ${textClass}`}>{children}</Text>
    ),
    [BLOCKS.UL_LIST]: (_node: Node, children: React.ReactNode) => (
      <View className="my-1 gap-0.5">{children}</View>
    ),
    [BLOCKS.OL_LIST]: (_node: Node, children: React.ReactNode) => (
      <View className="my-1 gap-0.5">{children}</View>
    ),
    [BLOCKS.LIST_ITEM]: (_node: Node, children: React.ReactNode) => (
      <View className="flex-row items-start">
        <Text className={`mr-1.5 text-sm leading-5 ${textClass}`}>{"•"}</Text>
        <View className="flex-1">{children}</View>
      </View>
    ),
    [BLOCKS.QUOTE]: (_node: Node, children: React.ReactNode) => (
      <View className="my-1 border-l-[3px] border-l-black/20 pl-3 opacity-80">{children}</View>
    ),
    [BLOCKS.HR]: () => <View className="my-2 h-px bg-black/10" />,
    [BLOCKS.TABLE]: (_node: Node, children: React.ReactNode) => (
      <View className="my-1 border border-black/15">{children}</View>
    ),
    [BLOCKS.TABLE_ROW]: (_node: Node, children: React.ReactNode) => (
      <View className="flex-row border-b border-b-black/10">{children}</View>
    ),
    [BLOCKS.TABLE_HEADER_CELL]: (_node: Node, children: React.ReactNode) => (
      <View className="flex-1 border-r border-r-black/10 bg-black/[4%] p-2">
        <Text className={`text-sm font-semibold leading-5 ${textClass}`}>{children}</Text>
      </View>
    ),
    [BLOCKS.TABLE_CELL]: (_node: Node, children: React.ReactNode) => (
      <View className="flex-1 border-r border-r-black/10 p-2">
        <Text className={`text-sm leading-5 ${textClass}`}>{children}</Text>
      </View>
    ),
    [INLINES.HYPERLINK]: (node: Node, children: React.ReactNode) => {
      const uri = (node.data as { uri?: string }).uri;
      if (!uri) return null;
      return (
        <Text
          className={`text-sm leading-5 underline ${textClass}`}
          onPress={() =>
            Linking.openURL(uri).catch((e) => console.warn("[ctf] failed to open url", e))
          }
        >
          {children}
        </Text>
      );
    },
  },
});

export function CtfRichText({
  json,
  textClass = "text-gray-900",
  inline = false,
}: CtfRichTextProps) {
  const options = inline ? makeInlineOptions(textClass) : makeOptions(textClass);
  return <>{documentToReactComponents(json, options)}</>;
}
