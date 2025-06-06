import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Lock, Mail } from "lucide-react-native";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Button from "~/components/Button";
import Input from "~/components/Input";
import Toast from "~/components/Toast";
import { useTheme } from "~/hooks/useTheme";

export default function LoginScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error" as "success" | "error" | "info" | "warning",
  });

  // Check if user is already logged in
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");

        if (token) {
          // Validate token (in a real app)
          // For now, just navigate to the main app
          router.replace("/(tabs)");
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthStatus();
  }, []);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email is invalid";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Here you would normally:
      // 1. Call your authentication API
      // 2. Store the token in secure storage

      // Mock storing a token
      await AsyncStorage.setItem("auth_token", "mock_token_123");

      // Navigate to the main app
      router.replace("/(tabs)");
    } catch {
      setToast({
        visible: true,
        message: "Login failed. Please check your credentials.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSOLogin = async () => {
    try {
      // Open web browser for SSO login
      const result = await WebBrowser.openAuthSessionAsync(
        "https://your-sso-provider.com/auth",
        "multispeqapp://auth/callback",
      );

      if (result.type === "success") {
        // Handle successful authentication
        // Extract token from URL and store it
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

  if (isCheckingAuth) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          {
            backgroundColor: theme.isDark
              ? colors.dark.background
              : colors.light.background,
          },
        ]}
      >
        <Text
          style={[
            styles.loadingText,
            {
              color: theme.isDark
                ? colors.dark.onSurface
                : colors.light.onSurface,
            },
          ]}
        >
          Loading...
        </Text>
      </View>
    );
  }

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
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              leftIcon={
                <Mail
                  size={20}
                  color={
                    theme.isDark ? colors.dark.inactive : colors.light.inactive
                  }
                />
              }
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              isPassword={true}
              error={errors.password}
              leftIcon={
                <Lock
                  size={20}
                  color={
                    theme.isDark ? colors.dark.inactive : colors.light.inactive
                  }
                />
              }
            />

            <Button
              title="Log In"
              onPress={handleLogin}
              isLoading={isLoading}
              style={styles.loginButton}
            />

            <View style={styles.divider}>
              <View
                style={[
                  styles.dividerLine,
                  {
                    backgroundColor: theme.isDark
                      ? colors.dark.border
                      : colors.light.border,
                  },
                ]}
              />
              <Text
                style={[
                  styles.dividerText,
                  {
                    color: theme.isDark
                      ? colors.dark.inactive
                      : colors.light.inactive,
                  },
                ]}
              >
                OR
              </Text>
              <View
                style={[
                  styles.dividerLine,
                  {
                    backgroundColor: theme.isDark
                      ? colors.dark.border
                      : colors.light.border,
                  },
                ]}
              />
            </View>

            <Button
              title="Sign in with SSO"
              variant="outline"
              onPress={handleSSOLogin}
              style={styles.ssoButton}
            />
          </View>

          <TouchableOpacity
            onPress={() =>
              WebBrowser.openBrowserAsync("https://your-website.com/register")
            }
            style={styles.registerLink}
          >
            <Text
              style={[
                styles.registerText,
                {
                  color: theme.isDark
                    ? colors.dark.inactive
                    : colors.light.inactive,
                },
              ]}
            >
              Don't have an account?{" "}
              <Text
                style={[
                  styles.registerHighlight,
                  { color: colors.primary.dark },
                ]}
              >
                Register on the web
              </Text>
            </Text>
          </TouchableOpacity>
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
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
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
  loginButton: {
    marginTop: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
  },
  ssoButton: {
    marginBottom: 16,
  },
  registerLink: {
    marginTop: "auto",
    alignItems: "center",
    padding: 16,
  },
  registerText: {
    fontSize: 14,
  },
  registerHighlight: {},
});
