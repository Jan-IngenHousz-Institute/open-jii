import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { User, ExternalLink, LogOut } from "lucide-react-native";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import Button from "~/components/Button";
import Card from "~/components/Card";
import Toast from "~/components/Toast";
import Colors from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

// Mock user data - replace with actual data from your state management
const mockUser = {
  email: "researcher@example.com",
  name: "Alex Researcher",
  organization: "Plant Science Institute",
  lastLogin: "2025-06-05 09:30:15",
};

export default function ProfileScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  const handleLogout = async () => {
    try {
      // Clear auth token
      await AsyncStorage.removeItem("auth_token");

      setToast({
        visible: true,
        message: "Logged out successfully",
        type: "success",
      });

      // Short delay to show the toast before navigating
      setTimeout(() => {
        // Navigate to login screen
        router.replace("/(auth)/login");
      }, 1000);
    } catch {
      setToast({
        visible: true,
        message: "Error logging out",
        type: "error",
      });
    }
  };

  const handleOpenWebProfile = async () => {
    const url = "https://your-website.com/profile";
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Error",
        "Cannot open web profile. Please check your internet connection.",
      );
    }
  };

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark
            ? colors.dark.background
            : colors.light.background,
        },
      ]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.profileHeader}>
        <View
          style={[
            styles.avatarContainer,
            { backgroundColor: colors.primary.dark + "30" },
          ]}
        >
          <User
            size={40}
            color={
              theme.isDark ? colors.dark.onSurface : colors.light.onSurface
            }
          />
        </View>
        <Text
          style={[
            styles.userName,
            {
              color: theme.isDark
                ? colors.dark.onSurface
                : colors.light.onSurface,
            },
          ]}
        >
          {mockUser.name}
        </Text>
        <Text
          style={[
            styles.userEmail,
            {
              color: theme.isDark
                ? colors.dark.inactive
                : colors.light.inactive,
            },
          ]}
        >
          {mockUser.email}
        </Text>
      </View>

      <Card style={styles.infoCard}>
        <Text
          style={[
            styles.infoTitle,
            {
              color: theme.isDark
                ? colors.dark.onSurface
                : colors.light.onSurface,
            },
          ]}
        >
          Account Information
        </Text>

        <View
          style={[
            styles.infoRow,
            {
              borderBottomColor: theme.isDark
                ? colors.dark.border
                : colors.light.border,
            },
          ]}
        >
          <Text
            style={[
              styles.infoLabel,
              {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            Organization
          </Text>
          <Text
            style={[
              styles.infoValue,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
            ]}
          >
            {mockUser.organization}
          </Text>
        </View>

        <View
          style={[
            styles.infoRow,
            {
              borderBottomColor: theme.isDark
                ? colors.dark.border
                : colors.light.border,
            },
          ]}
        >
          <Text
            style={[
              styles.infoLabel,
              {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            Last Login
          </Text>
          <Text
            style={[
              styles.infoValue,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
            ]}
          >
            {mockUser.lastLogin}
          </Text>
        </View>
      </Card>

      <View style={styles.actionsContainer}>
        <Button
          title="Open Web Profile"
          onPress={handleOpenWebProfile}
          variant="outline"
          style={styles.actionButton}
          icon={<ExternalLink size={16} color={colors.primary.dark} />}
        />

        <Button
          title="Log Out"
          onPress={handleLogout}
          variant="outline"
          style={[styles.actionButton, styles.logoutButton] as any}
          textStyle={styles.logoutButtonText}
          icon={<LogOut size={16} color={colors.semantic.error} />}
        />
      </View>

      <Text
        style={[
          styles.versionText,
          {
            color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
          },
        ]}
      >
        MultiSpeq App v1.0.0
      </Text>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  profileHeader: {
    alignItems: "center",
    marginVertical: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
  },
  infoCard: {
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    borderColor: Colors.semantic.error,
  },
  logoutButtonText: {
    color: Colors.semantic.error,
  },
  versionText: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 24,
  },
});
