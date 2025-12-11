import { clsx } from "clsx";
import { AlertCircle, Info, AlertTriangle } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";

export interface MacroMessageGroup {
  info?: string[];
  warning?: string[];
  danger?: string[];
}

interface MacroMessagesProps {
  messages: MacroMessageGroup[];
}

export function MacroMessages({ messages }: MacroMessagesProps) {
  if (!messages || messages.length === 0) {
    return null;
  }

  const allMessages = messages.flatMap((msg) => [
    ...(msg.danger ?? []).map((text) => ({ type: "danger" as const, text })),
    ...(msg.warning ?? []).map((text) => ({ type: "warning" as const, text })),
    ...(msg.info ?? []).map((text) => ({ type: "info" as const, text })),
  ]);

  if (allMessages.length === 0) {
    return null;
  }

  const dangerMessages = allMessages.filter((m) => m.type === "danger");
  const warningMessages = allMessages.filter((m) => m.type === "warning");
  const infoMessages = allMessages.filter((m) => m.type === "info");

  return (
    <View className="gap-3">
      {dangerMessages.length > 0 && (
        <View
          className={clsx(
            "rounded-lg border-l-4 border-red-500 bg-red-50 p-4 dark:border-red-400 dark:bg-red-900/20",
          )}
        >
          <View className="mb-2 flex-row items-center gap-2">
            <AlertCircle size={20} color="#ef4444" />
            <Text className="text-base font-semibold text-red-800 dark:text-red-300">
              Critical Issues
            </Text>
          </View>
          <View className="gap-1.5">
            {dangerMessages.map((msg, idx) => (
              <View key={idx} className="flex-row gap-2">
                <Text className="text-red-700 dark:text-red-300">•</Text>
                <Text className="flex-1 text-sm leading-5 text-red-700 dark:text-red-300">
                  {msg.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {warningMessages.length > 0 && (
        <View
          className={clsx(
            "rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-4 dark:border-yellow-400 dark:bg-yellow-900/20",
          )}
        >
          <View className="mb-2 flex-row items-center gap-2">
            <AlertTriangle size={20} color="#eab308" />
            <Text className="text-base font-semibold text-yellow-800 dark:text-yellow-300">
              Warnings
            </Text>
          </View>
          <View className="gap-1.5">
            {warningMessages.map((msg, idx) => (
              <View key={idx} className="flex-row gap-2">
                <Text className="text-yellow-700 dark:text-yellow-300">•</Text>
                <Text className="flex-1 text-sm leading-5 text-yellow-700 dark:text-yellow-300">
                  {msg.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {infoMessages.length > 0 && (
        <View
          className={clsx(
            "rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4 dark:border-blue-400 dark:bg-blue-900/20",
          )}
        >
          <View className="mb-2 flex-row items-center gap-2">
            <Info size={20} color="#3b82f6" />
            <Text className="text-base font-semibold text-blue-800 dark:text-blue-300">
              Information
            </Text>
          </View>
          <View className="gap-1.5">
            {infoMessages.map((msg, idx) => (
              <View key={idx} className="flex-row gap-2">
                <Text className="text-blue-700 dark:text-blue-300">•</Text>
                <Text className="flex-1 text-sm leading-5 text-blue-700 dark:text-blue-300">
                  {msg.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
