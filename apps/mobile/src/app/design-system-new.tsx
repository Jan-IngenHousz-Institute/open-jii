import { Mail } from "lucide-react-native";
import React from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { JIIButton } from "~/components/JIIButton";
import { JIICard } from "~/components/JIICard";
import { JIIInput } from "~/components/JIIInput";
import { JIIText } from "~/components/JIIText";
import { JIIThemeToggle } from "~/components/JIIThemeToggle";
import { useDesignSystemLogic } from "~/hooks/useDesignSystemLogic";

export default function DesignSystemScreen() {
  const {
    theme,
    colors,
    getColorSwatches,
    getButtonDemos,
    getInputDemos,
    getTypographyDemos,
    getCardDemos,
  } = useDesignSystemLogic();

  const colorSwatches = getColorSwatches();
  const buttonDemos = getButtonDemos();
  const inputDemos = getInputDemos();
  const typographyDemos = getTypographyDemos();
  const cardDemos = getCardDemos();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <JIIText variant="h2">JII Design System</JIIText>
      <JIIText variant="lead" style={styles.sectionDescription}>
        A comprehensive design system for building beautiful, consistent
        interfaces.
      </JIIText>

      <View style={styles.section}>
        <JIIText variant="h4">Theme Toggle</JIIText>
        <JIIThemeToggle />
      </View>

      <View style={styles.section}>
        <JIIText variant="h4">Colors</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Primary and secondary colors from the JII Design System.
        </JIIText>

        <View style={styles.colorGrid}>
          {colorSwatches.map((swatch, index) => {
            if (index % 2 === 0) {
              const nextSwatch = colorSwatches[index + 1];
              return (
                <View key={index} style={styles.colorRow}>
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: swatch.color },
                    ]}
                  >
                    <JIIText variant="caption" color={swatch.textColor}>
                      {swatch.name}
                    </JIIText>
                  </View>
                  {nextSwatch && (
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: nextSwatch.color },
                      ]}
                    >
                      <JIIText variant="caption" color={nextSwatch.textColor}>
                        {nextSwatch.name}
                      </JIIText>
                    </View>
                  )}
                </View>
              );
            }
            return null;
          })}
        </View>
      </View>

      <View style={styles.section}>
        <JIIText variant="h4">Typography</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Text variants and styles.
        </JIIText>

        {typographyDemos.map((demo, index) => (
          <JIIText key={index} variant={demo.variant as any}>
            {demo.text}
          </JIIText>
        ))}

        <View style={styles.spacer} />
      </View>

      <View style={styles.section}>
        <JIIText variant="h4">Buttons</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Button variants and sizes.
        </JIIText>

        <View style={styles.buttonRow}>
          <JIIButton title="Primary" variant="primary" style={styles.button} />
          <JIIButton
            title="Secondary"
            variant="secondary"
            style={styles.button}
          />
        </View>

        <View style={styles.buttonRow}>
          <JIIButton title="Outline" variant="outline" style={styles.button} />
          <JIIButton title="Ghost" variant="ghost" style={styles.button} />
        </View>

        <View style={styles.buttonRow}>
          <JIIButton title="Small" size="sm" style={styles.button} />
          <JIIButton title="Medium" size="md" style={styles.button} />
          <JIIButton title="Large" size="lg" style={styles.button} />
        </View>

        <View style={styles.buttonRow}>
          <JIIButton
            title="With Icon"
            icon={<Mail size={16} color="#fff" />}
            style={styles.button}
          />
          <JIIButton title="Loading" isLoading={true} style={styles.button} />
          <JIIButton title="Disabled" isDisabled={true} style={styles.button} />
        </View>
      </View>

      <View style={styles.section}>
        <JIIText variant="h4">Cards</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Card variants for containing content.
        </JIIText>

        {cardDemos.map((demo, index) => (
          <JIICard key={index} variant={demo.variant as any}>
            <JIIText variant="h5">{demo.title}</JIIText>
            <JIIText variant="body">{demo.content}</JIIText>
          </JIICard>
        ))}
      </View>

      <View style={styles.section}>
        <JIIText variant="h4">Inputs</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Form input components.
        </JIIText>

        {inputDemos.map((demo, index) => (
          <JIIInput
            key={index}
            label={demo.label}
            placeholder={demo.placeholder}
            helper={demo.helper}
            error={demo.error}
            value={demo.value}
            isPassword={demo.isPassword}
            leftIcon={
              demo.label === "With Icon" ? (
                <Mail
                  size={20}
                  color={
                    theme.isDark
                      ? theme.colors.dark.inactive
                      : theme.colors.light.inactive
                  }
                />
              ) : undefined
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginTop: 32,
    marginBottom: 16,
  },
  sectionDescription: {
    marginTop: 8,
    marginBottom: 16,
  },
  colorGrid: {
    marginTop: 16,
  },
  colorRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  colorSwatch: {
    flex: 1,
    height: 80,
    marginHorizontal: 4,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  button: {
    margin: 4,
  },
  spacer: {
    height: 16,
  },
});
