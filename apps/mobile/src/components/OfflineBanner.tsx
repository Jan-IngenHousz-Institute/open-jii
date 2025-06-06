import { WifiOff } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "~/constants/colors";

interface OfflineBannerProps {
  visible: boolean;
}

export default function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <WifiOff size={16} color="#fff" />
      <Text style={styles.text}>Offline Mode</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.semantic.warning,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  text: {
    color: "#fff",
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "500",
  },
});
