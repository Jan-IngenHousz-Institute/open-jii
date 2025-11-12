import "expo-application";
import * as Application from "expo-application";
import { useRouter } from "expo-router";
import { User, ExternalLink, LogOut } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from "react-native";
import { toast } from "sonner-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { colors } from "~/constants/colors";
import { useSessionStore } from "~/hooks/use-session-store";
import { useTheme } from "~/hooks/use-theme";
import { getEnvVar } from "~/stores/environment-store";
import { formatRelativeTime } from "~/utils/format-relative-time";

export default function ProfileScreen() {
  const { clearSession, session } = useSessionStore();
  const router = useRouter();
  const theme = useTheme();
  const { colors } = theme;

  const handleLogout = () => {
    clearSession();
    router.replace("/callback");
  };

  const handleOpenWebProfile = async () => {
    const url = getEnvVar("NEXT_AUTH_URI") + "/en-US/platform/experiments";
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Cannot open web profile. Please check your internet connection.");
    }
  };

  const handleTestToast = (type: "success" | "error" | "info") => {
    const message = `${type.charAt(0).toUpperCase() + type.slice(1)} Toast`;
    const description = `This is a test ${type} message`;
    
    if (type === "success") {
      toast.success(message, { description });
    } else if (type === "error") {
      toast.error(message, { description });
    } else {
      toast.info(message, { description });
    }
  };

  if (!session) {
    return null;
  }

  const { user, expires } = session.data;

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.profileHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary.dark + "30" }]}>
          <User size={40} color={theme.isDark ? colors.dark.onSurface : colors.light.onSurface} />
        </View>
        <Text
          style={[
            styles.userName,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          {user.name}
        </Text>
        <Text
          style={[
            styles.userEmail,
            {
              color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
            },
          ]}
        >
          {user.email}
        </Text>
      </View>

      <Card style={styles.infoCard}>
        <Text
          style={[
            styles.infoTitle,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          Account Information
        </Text>

        <View
          style={[
            styles.infoRow,
            {
              borderBottomColor: theme.isDark ? colors.dark.border : colors.light.border,
            },
          ]}
        >
          <Text
            style={[
              styles.infoLabel,
              {
                color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
              },
            ]}
          >
            Organization
          </Text>
          <Text
            style={[
              styles.infoValue,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            N/A
          </Text>
        </View>

        <View
          style={[
            styles.infoRow,
            {
              borderBottomColor: theme.isDark ? colors.dark.border : colors.light.border,
            },
          ]}
        >
          <Text
            style={[
              styles.infoLabel,
              {
                color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
              },
            ]}
          >
            Login Expires
          </Text>
          <Text
            style={[
              styles.infoValue,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            {formatRelativeTime(expires)}
          </Text>
        </View>
      </Card>

      <Card style={styles.testCard}>
        <Text
          style={[
            styles.testTitle,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          Test Toasts
        </Text>
        <View style={styles.testButtonsContainer}>
          <Button
            title="Success"
            onPress={() => handleTestToast("success")}
            variant="primary"
            size="sm"
            style={styles.testButton}
          />
          <Button
            title="Error"
            onPress={() => handleTestToast("error")}
            variant="primary"
            size="sm"
            style={styles.testButton}
          />
          <Button
            title="Info"
            onPress={() => handleTestToast("info")}
            variant="primary"
            size="sm"
            style={styles.testButton}
          />
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
        openJII v{Application.nativeApplicationVersion}
      </Text>
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
  testCard: {
    marginBottom: 24,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  testButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  testButton: {
    flex: 1,
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
    borderColor: colors.semantic.error,
  },
  logoutButtonText: {
    color: colors.semantic.error,
  },
  versionText: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 24,
  },
});
