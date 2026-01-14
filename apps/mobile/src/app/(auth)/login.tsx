/* eslint-disable @typescript-eslint/no-require-imports */
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
} from "react-native";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { useLoginFlow } from "~/hooks/use-login";
import { useMultiTapReveal } from "~/hooks/use-multi-tap-reveal";
import { useTheme } from "~/hooks/use-theme";
import { EnvironmentSelector } from "~/widgets/environment-selector";

const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const router = useRouter();
  const { startGitHubLogin, startOrcidLogin, sendEmailOTP, verifyEmailOTP, loading } =
    useLoginFlow();

  const { isVisible: showEnvSelector, handleTap: handleHeaderTap } = useMultiTapReveal({
    tapsRequired: 4,
    intervalMs: 600,
  });

  const [showEmailForm, setShowEmailForm] = useState(false);
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
      setError(result.error.message ?? "Invalid or expired code");
      return;
    }

    // Check if user is registered (similar to web app)
    // For now, just navigate to tabs - registration flow can be added later
    router.replace("(tabs)");
  }

  async function handleResendCode() {
    if (loading || countdown > 0) return;

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

  function handleBackToMethods() {
    setShowEmailForm(false);
    setShowOTPInput(false);
    setEmail("");
    setOTP("");
    setError("");
    setCountdown(0);
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

            {!showEmailForm ? (
              <>
                {/* OAuth Providers */}
                <Button
                  title="Continue with GitHub"
                  variant="outline"
                  onPress={handleGitHubLogin}
                  style={styles.authButton}
                  disabled={loading}
                />
                <Button
                  title="Continue with ORCID"
                  variant="outline"
                  onPress={handleOrcidLogin}
                  style={styles.authButton}
                  disabled={loading}
                />

                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={[styles.dividerText, { color: mutedColor }]}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Email OTP */}
                <Button
                  title="Continue with Email"
                  variant="outline"
                  onPress={() => setShowEmailForm(true)}
                  style={styles.authButton}
                  disabled={loading}
                />
              </>
            ) : (
              <>
                {!showOTPInput ? (
                  <>
                    {/* Email Input */}
                    <Input
                      label="Email Address"
                      placeholder="Enter your email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      error={error}
                    />
                    <Button
                      title={loading ? "Sending..." : "Send Code"}
                      variant="primary"
                      onPress={handleEmailSubmit}
                      style={styles.authButton}
                      disabled={loading}
                    />
                    <Button
                      title="Back"
                      variant="outline"
                      onPress={handleBackToMethods}
                      style={styles.authButton}
                      disabled={loading}
                    />
                  </>
                ) : (
                  <>
                    {/* OTP Input */}
                    <Text style={[styles.heading, { color: textColor }]}>Check your email</Text>
                    <Text style={[styles.helperText, { color: mutedColor }]}>
                      Enter the 6-digit code sent to{" "}
                      <Pressable onPress={handleEditEmail}>
                        <Text style={[styles.emailLink, { color: "#005e5e" }]}>{email}</Text>
                      </Pressable>
                    </Text>
                    <Input
                      placeholder="000000"
                      value={otp}
                      onChangeText={setOTP}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!loading}
                      autoFocus
                      error={error}
                      containerStyle={{ marginTop: 8 }}
                    />

                    <Pressable
                      onPress={handleResendCode}
                      disabled={countdown > 0 || loading}
                      style={styles.resendButton}
                    >
                      <Text
                        style={[
                          styles.resendText,
                          { color: countdown > 0 || loading ? mutedColor : "#005e5e" },
                        ]}
                      >
                        {countdown > 0 ? `Resend code (${countdown}s)` : "Resend code"}
                      </Text>
                    </Pressable>

                    <Button
                      title={loading ? "Verifying..." : "Verify Code"}
                      variant="primary"
                      onPress={handleOTPVerify}
                      style={styles.authButton}
                      disabled={loading || otp.length !== 6}
                    />
                    <Button
                      title="Back"
                      variant="outline"
                      onPress={handleBackToMethods}
                      style={styles.authButton}
                      disabled={loading}
                    />
                  </>
                )}
              </>
            )}

            {loading && (
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
    justifyContent: "center",
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
  authButton: {
    marginBottom: 12,
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
    marginBottom: 12,
    lineHeight: 20,
  },
  emailLink: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  resendButton: {
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  resendText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    marginTop: 16,
    alignItems: "center",
  },
});
