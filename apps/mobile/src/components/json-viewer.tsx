import React from "react";
import { ScrollView, Text, View } from "react-native";

// temporary component to be replaced with a proper scan view
export function JSONViewer({ data, indent = 0 }) {
  const renderValue = (value: any, level: number) => {
    if (typeof value !== "object" || value === null) {
      return (
        <Text className="text-muted-foreground w-full break-words text-sm">{String(value)}</Text>
      );
    }

    if (Array.isArray(value)) {
      return (
        <View className="border-border my-1 w-full border-l pl-4">
          {value.map((item, idx) => (
            <View key={idx} className="mb-1 w-full">
              {renderValue(item, level + 1)}
            </View>
          ))}
        </View>
      );
    }

    return (
      <View className="border-border my-1 w-full border-l pl-4">
        {Object.entries(value).map(([key, val], idx) => (
          <View key={idx} className="mb-1 w-full">
            <Text className="text-foreground text-sm font-semibold">{key}:</Text>
            <View className="ml-2">{renderValue(val, level + 1)}</View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView className="bg-background w-full flex-1">
      <View className="w-full p-4">{renderValue(data, indent)}</View>
    </ScrollView>
  );
}
