import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Leaf } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

export function HomePrimaryCta() {
  const router = useRouter();
  const { t } = useTranslation("home");

  const onStart = () => router.push("/measurement-flow");

  return (
    <Pressable onPress={onStart} className="mt-2">
      <LinearGradient
        colors={["#fff481", "#fbf8c1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 22,
          padding: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.06)",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            opacity: 0.25,
            pointerEvents: "none",
          }}
        >
          <Leaf size={120} color="#7a6300" strokeWidth={1.2} />
        </View>

        <View style={{ position: "relative" }}>
          <Text style={{ fontFamily: "Poppins-Bold", fontSize: 19, color: "#1c1c1c" }}>
            {t("cta.title")}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: "#5a4d00",
              marginTop: 4,
              marginBottom: 14,
              maxWidth: 240,
            }}
          >
            {t("cta.body")}
          </Text>
          <Button
            title={t("cta.action")}
            onPress={onStart}
            variant="primary"
            size="md"
            style={{ alignSelf: "flex-start" }}
            icon={<ChevronRight size={18} color="#FFFFFF" />}
            iconPosition="right"
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}
