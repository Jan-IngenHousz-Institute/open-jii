import { User, ExternalLink, LogOut } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { Toast } from "~/components/Toast";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";
import { useProfileScreenLogic } from "~/screens/profile/useProfileScreenLogic";

export default function ProfileTab() {
  const theme = useTheme();
  const logic = useProfileScreenLogic();

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
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View
          style={[
            styles.avatarContainer,
            {
              backgroundColor: colors.primary.dark + "20",
              borderColor: colors.primary.dark,
              borderWidth: 2,
            },
          ]}
        >
          <User size={40} color={colors.primary.dark} />
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
          {logic.user.name}
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
          {logic.user.email}
        </Text>
      </View>

      {/* Account Information Card */}
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
            {logic.user.organization}
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
            {logic.user.lastLogin}
          </Text>
        </View>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <Button
          title="Open Web Profile"
          onPress={logic.handleOpenWebProfile}
          variant="outline"
          style={styles.actionButton}
          icon={<ExternalLink size={16} color={colors.primary.dark} />}
        />

        <Button
          title="Log Out"
          onPress={logic.handleLogout}
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
        visible={logic.toast.visible}
        message={logic.toast.message}
        type={logic.toast.type}
        onDismiss={() => logic.setToast({ ...logic.toast, visible: false })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
