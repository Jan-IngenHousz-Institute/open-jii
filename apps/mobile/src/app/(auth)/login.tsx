import { Lock, Mail } from "lucide-react-native";
import React from "react";
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
  ActivityIndicator,
} from "react-native";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { Toast } from "~/components/Toast";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";
import { useAuthScreenLogic } from "~/screens/auth/useAuthScreenLogic";

export default function LoginPage() {
  const theme = useTheme();
  const logic = useAuthScreenLogic();

  // Show loading screen while checking auth status
  if (logic.isCheckingAuth) {
    return (
      <SafeAreaView
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
        <ActivityIndicator
          size="large"
          color={colors.primary.dark}
          style={{ marginBottom: 16 }}
        />
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
          Checking authentication...
        </Text>
      </SafeAreaView>
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
              value={logic.email}
              onChangeText={logic.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
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
              value={logic.password}
              onChangeText={logic.setPassword}
              secureTextEntry
              autoComplete="password"
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
              onPress={logic.handleLogin}
              isLoading={logic.isLoading}
              style={styles.loginButton}
            />

            <TouchableOpacity
              onPress={logic.handleForgotPassword}
              style={styles.forgotPasswordButton}
            >
              <Text
                style={[
                  styles.forgotPasswordText,
                  { color: colors.primary.dark },
                ]}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View
                style={[
                  styles.dividerLine,
                  {
                    borderBottomColor: theme.isDark
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
                    backgroundColor: theme.isDark
                      ? colors.dark.background
                      : colors.light.background,
                  },
                ]}
              >
                or
              </Text>
              <View
                style={[
                  styles.dividerLine,
                  {
                    borderBottomColor: theme.isDark
                      ? colors.dark.border
                      : colors.light.border,
                  },
                ]}
              />
            </View>

            <Button
              title="Continue with Google"
              variant="outline"
              onPress={logic.handleGoogleLogin}
              style={styles.googleButton}
            />

            <View style={styles.signUpContainer}>
              <Text
                style={[
                  styles.signUpText,
                  {
                    color: theme.isDark
                      ? colors.dark.inactive
                      : colors.light.inactive,
                  },
                ]}
              >
                Don't have an account?{" "}
              </Text>
              <TouchableOpacity onPress={logic.handleSignUp}>
                <Text
                  style={[styles.signUpLink, { color: colors.primary.dark }]}
                >
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        visible={logic.toast.visible}
        message={logic.toast.message}
        type={logic.toast.type}
        onDismiss={() => logic.setToast({ ...logic.toast, visible: false })}
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
    justifyContent: "center",
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    fontFamily: "Poppins-Bold",
  },
  tagline: {
    fontSize: 16,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  loginButton: {
    marginTop: 24,
    marginBottom: 16,
  },
  forgotPasswordButton: {
    alignSelf: "center",
    padding: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    borderBottomWidth: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    marginBottom: 24,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    fontSize: 14,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: "600",
  },
});
