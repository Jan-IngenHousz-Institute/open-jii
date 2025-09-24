import { Bluetooth, Radio, Usb, Bot } from "lucide-react-native";
import React from "react";
import { Platform, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/use-theme";
import { DeviceType } from "~/types/device";

interface Props {
  type: DeviceType;
  selected: boolean;
  onSelect: () => void;
}

export function ConnectionTypeSelector({ type, selected, onSelect }: Props) {
  const theme = useTheme();
  const isDisabled = Platform.OS === "ios" && (type === "usb" || type === "bluetooth-classic");

  const getIcon = () => {
    switch (type) {
      case "bluetooth-classic":
        return <Bluetooth size={24} color={getIconColor()} />;
      case "ble":
        return <Radio size={24} color={getIconColor()} />;
      case "usb":
        return <Usb size={24} color={getIconColor()} />;
      case "mock-device":
        return <Bot size={24} color={getIconColor()} />;
    }
  };

  const getIconColor = () => {
    if (selected) return colors.primary.dark;
    if (isDisabled) return theme.isDark ? colors.dark.inactive : colors.light.inactive;
    return theme.isDark ? colors.dark.onSurface : colors.light.onSurface;
  };

  const label = {
    "bluetooth-classic": "Bluetooth Classic",
    ble: "Bluetooth LE",
    usb: "USB Serial",
    "mock-device": "Mock Device",
  }[type];

  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={isDisabled}
      style={[
        styles.button,
        {
          backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
        },
        selected && {
          borderWidth: 1,
          borderColor: colors.primary.dark,
          backgroundColor: colors.primary.dark + "10",
        },
      ]}
    >
      {getIcon()}
      <Text
        style={[
          styles.label,
          {
            color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
          },
          selected && { color: colors.primary.dark, fontWeight: "bold" },
          isDisabled && {
            color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
          },
        ]}
      >
        {label}
      </Text>
      {isDisabled && (type === "usb" || type === "bluetooth-classic") && (
        <Text
          style={[
            styles.platformNote,
            {
              color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
            },
          ]}
        >
          Android only
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
  },
  platformNote: {
    fontSize: 10,
    marginTop: 4,
  },
});
