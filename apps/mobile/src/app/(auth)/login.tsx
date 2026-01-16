/* eslint-disable @typescript-eslint/no-require-imports */
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { OTPInput } from "~/components/OTPInput";
import { useLoginFlow } from "~/hooks/use-login";
import { useMultiTapReveal } from "~/hooks/use-multi-tap-reveal";
import { useTheme } from "~/hooks/use-theme";
import { getEnvVar } from "~/stores/environment-store";
import { EnvironmentSelector } from "~/widgets/environment-selector";

const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const router = useRouter();
  const webBaseUrl = getEnvVar("NEXT_AUTH_URI");
  const {
    startGitHubLogin,
    startOrcidLogin,
    sendEmailOTP,
    verifyEmailOTP,
    githubLoading,
    orcidLoading,
    emailLoading,
    verifyLoading,
  } = useLoginFlow();

  const { isVisible: showEnvSelector, handleTap: handleHeaderTap } = useMultiTapReveal({
    tapsRequired: 4,
    intervalMs: 600,
  });

  const [showOTPInput, setShowOTPInput] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOTP] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (otp.length === 6 && !verifyLoading) {
      void handleOTPVerify();
    }
  }, [otp, verifyLoading]);

  async function handleGitHubLogin() {
    setError("");
    await startGitHubLogin();
    router.replace("(tabs)");
  }

  async function handleOrcidLogin() {
    setError("");
    await startOrcidLogin();
    router.replace("(tabs)");
  }

  async function handleEmailSubmit() {
    setError("");
    if (!email?.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    const result = await sendEmailOTP(email);
    if (result?.error) {
      setError(result.error.message ?? "Failed to send code");
      return;
    }

    setShowOTPInput(true);
    setCountdown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleOTPVerify() {
    setError("");
    if (otp?.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    const result = await verifyEmailOTP(email, otp);
    if (result?.error) {
      setError(
        "The code you entered is invalid or has expired. Please try again or request a new one.",
      );
      return;
    }

    // Check if user is registered (similar to web app)
    // For now, just navigate to tabs - registration flow can be added later
    router.replace("(tabs)");
  }

  async function handleResendCode() {
    if (emailLoading || countdown > 0) return;

    setError("");
    const result = await sendEmailOTP(email);
    if (result?.error) {
      setError(result.error.message ?? "Failed to resend code");
      return;
    }

    setOTP("");
    setCountdown(RESEND_COOLDOWN_SECONDS);
  }

  function handleEditEmail() {
    setShowOTPInput(false);
    setOTP("");
    setError("");
  }

  const textColor = theme.isDark ? colors.dark.onSurface : colors.light.onSurface;
  const mutedColor = theme.isDark ? colors.dark.inactive : colors.light.inactive;

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
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
            <Pressable onPress={handleHeaderTap} hitSlop={10}>
              <Image source={require("../../../assets/splash-icon.png")} style={styles.logo} />
            </Pressable>
            <Text style={[styles.appName, { color: textColor }]}>openJII</Text>
            <Text style={[styles.tagline, { color: mutedColor }]}>Sensor Data Collection</Text>
          </View>

          <View style={styles.formContainer}>
            {showEnvSelector && <EnvironmentSelector />}

            {!showOTPInput ? (
              <>
                {/* Title */}
                <Text style={[styles.loginTitle, { color: textColor }]}>Log in or sign up</Text>

                {/* Email Input - Inline */}
                <Text style={[styles.fieldLabel, { color: textColor }]}>Email address</Text>
                <Input
                  placeholder="Enter your email..."
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!emailLoading}
                  error={error}
                  containerStyle={{ marginBottom: 12 }}
                />
                <Button
                  title="Continue with Email"
                  variant="primary"
                  onPress={handleEmailSubmit}
                  style={styles.authButton}
                  isDisabled={emailLoading}
                  isLoading={emailLoading}
                />

                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={[styles.dividerText, { color: mutedColor }]}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* OAuth Providers */}
                <View style={styles.providersGrid}>
                  <Button
                    title="GitHub"
                    variant="surface"
                    onPress={handleGitHubLogin}
                    isDisabled={githubLoading}
                    isLoading={githubLoading}
                    icon={
                      <Svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
                        <Path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </Svg>
                    }
                    style={styles.providerButton}
                  />

                  <Button
                    title="ORCID"
                    variant="surface"
                    onPress={handleOrcidLogin}
                    isDisabled={orcidLoading}
                    isLoading={orcidLoading}
                    icon={
                      <Svg width="20" height="20" viewBox="0 0 24 24">
                        <Path
                          d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947 0 .525-.422.947-.947.947A.943.943 0 0 1 6.422 5.325c0-.516.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c2.359 0 3.588-1.313 3.588-3.722 0-2.2-1.313-3.722-3.588-3.722h-2.297z"
                          fill="#A6CE39"
                        />
                      </Svg>
                    }
                    style={styles.providerButton}
                  />
                </View>

                {/* Terms and Conditions */}
                <Text style={[styles.termsText, { color: mutedColor }]}>
                  By continuing you accept the{" "}
                  <Text
                    style={[styles.termsLink, { color: "#005e5e" }]}
                    onPress={() => void Linking.openURL(`${webBaseUrl}/terms-and-conditions`)}
                  >
                    terms and conditions
                  </Text>
                </Text>
              </>
            ) : (
              <>
                {/* Back button */}
                <Pressable onPress={handleEditEmail} style={styles.backButton} hitSlop={10}>
                  <MaterialIcons name="arrow-back" size={24} color={textColor} />
                </Pressable>

                {/* OTP Input */}
                <Text style={[styles.loginTitle, { color: textColor }]}>
                  Check your email for a sign-in code
                </Text>
                <Text style={[styles.helperText, { color: mutedColor }]}>
                  Please enter the 6-digit code we sent to{" "}
                  <Text style={[styles.emailLink, { color: "#005e5e" }]} onPress={handleEditEmail}>
                    {email}
                  </Text>{" "}
                  <MaterialIcons
                    name="edit"
                    size={16}
                    color="#005e5e"
                    onPress={handleEditEmail}
                    style={{ marginLeft: 4 }}
                  />
                </Text>
                <OTPInput
                  value={otp}
                  onChangeText={setOTP}
                  length={6}
                  editable={!verifyLoading}
                  autoFocus
                  error={!!error}
                />
                {error ? (
                  <Text style={[styles.errorText, { color: "#dc2626" }]}>{error}</Text>
                ) : null}

                <Pressable
                  onPress={handleResendCode}
                  disabled={countdown > 0 || emailLoading}
                  style={styles.resendButton}
                >
                  <Text
                    style={[
                      styles.resendText,
                      { color: countdown > 0 || emailLoading ? mutedColor : "#005e5e" },
                    ]}
                  >
                    {countdown > 0 ? `Re-send code (${countdown}s)` : "Re-send code"}
                  </Text>
                </Pressable>
              </>
            )}

            {(githubLoading || orcidLoading || emailLoading || verifyLoading) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.isDark ? "#fff" : "#000"} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: "flex-start",
    paddingTop: 48,
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 0,
    marginBottom: 48,
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
  betaBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 24,
  },
  betaBadgeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  authButton: {
    marginBottom: 12,
  },
  providersGrid: {
    flexDirection: "column",
    gap: 12,
    marginBottom: 12,
  },
  providerButton: {
    marginBottom: 0,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  heading: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  emailLink: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  resendButton: {
    marginTop: 20,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  resendText: {
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  loadingContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  termsText: {
    fontSize: 12,
    marginTop: 24,
    lineHeight: 18,
  },
  termsLink: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  backButton: {
    marginBottom: 16,
    alignSelf: "flex-start",
  },
});
