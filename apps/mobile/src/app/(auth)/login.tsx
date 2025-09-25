import { CommonActions, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { useAsync } from "react-async-hook";
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
import { getSessionData } from "~/api/get-session-data";
import { Button } from "~/components/Button";
import { Toast } from "~/components/Toast";
import { useLoginFlow } from "~/hooks/use-login";
import { useSessionStore } from "~/hooks/use-session-store";
import { useTheme } from "~/hooks/use-theme";

export default function LoginScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error" as "success" | "error" | "info" | "warning",
  });

  const router = useRouter();
  const { startLoginFlow } = useLoginFlow();
  const { setSession } = useSessionStore();
  const { session_token: token } = useLocalSearchParams();

  const navigation = useNavigation();

  // this one is for Android
  useAsync(async () => {
    if (typeof token !== "string") {
      return;
    }
    const data = await getSessionData(token);
    setSession({ data, token });
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "(tabs)" }],
      }),
    );
  }, [token]);

  // this one is for iPhone
  async function handleLogin() {
    const session = await startLoginFlow();
    if (!session) {
      return;
    }
    setSession(session);
    router.replace("(tabs)");
  }
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
                  color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                },
              ]}
            >
              OpenJII
            </Text>
            <Text
              style={[
                styles.tagline,
                {
                  color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
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
              onPress={handleLogin}
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
