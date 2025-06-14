import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Button } from "~/components/Button";
import { Toast } from "~/components/Toast";
import { useTheme } from "~/hooks/useTheme";

export default function LoginScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error" as "success" | "error" | "info" | "warning",
  });

  const handleSSOLogin = async () => {
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        "https://your-sso-provider.com/auth",
        "multispeqapp://auth/callback",
      );

      if (result.type === "success") {
        await AsyncStorage.setItem("auth_token", "mock_sso_token_123");
        router.replace("/(tabs)");
      }
    } catch {
      setToast({
        visible: true,
        message: "SSO login failed. Please try again.",
        type: "error",
      });
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark
            ? colors.dark.background
            : colors.light.background,
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1507668339897-8a035aa9527d?q=80&w=200&auto=format&fit=crop",
              }}
              style={styles.logo}
            />
            <Text
              style={[
                styles.appName,
                {
                  color: theme.isDark
                    ? colors.dark.onSurface
                    : colors.light.onSurface,
                },
              ]}
            >
              MultiSpeq
            </Text>
            <Text
              style={[
                styles.tagline,
                {
                  color: theme.isDark
                    ? colors.dark.inactive
                    : colors.light.inactive,
                },
              ]}
            >
              Sensor Data Collection
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.divider}></View>
            <Button
              title="Sign in with SSO"
              variant="outline"
              onPress={handleSSOLogin}
              style={styles.ssoButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 16,
  },
  tagline: {
    fontSize: 16,
    marginTop: 8,
  },
  formContainer: {
    width: "100%",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  ssoButton: {
    marginBottom: 16,
  },
});
