import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import JIIText from '@/components/JIIText';
import JIIButton from '@/components/JIIButton';
import JIICard from '@/components/JIICard';
import JIIInput from '@/components/JIIInput';
import JIIThemeToggle from '@/components/JIIThemeToggle';
import { Mail } from 'lucide-react-native';

export default function DesignSystemScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  
  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <JIIText variant="h2">JII Design System</JIIText>
      <JIIText variant="lead" style={styles.sectionDescription}>
        A comprehensive design system for building beautiful, consistent interfaces.
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
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: colors.primary.dark }]}>
              <JIIText variant="caption" color="#fff">Primary Dark</JIIText>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: colors.primary.bright }]}>
              <JIIText variant="caption" color="#000">Primary Bright</JIIText>
            </View>
          </View>
          
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: colors.secondary.blue }]}>
              <JIIText variant="caption" color="#000">Secondary Blue</JIIText>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: colors.secondary.blueLight }]}>
              <JIIText variant="caption" color="#000">Secondary Blue 50%</JIIText>
            </View>
          </View>
          
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: colors.secondary.yellow }]}>
              <JIIText variant="caption" color="#000">Secondary Yellow</JIIText>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: colors.secondary.yellowLight }]}>
              <JIIText variant="caption" color="#000">Secondary Yellow 50%</JIIText>
            </View>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <JIIText variant="h4">Typography</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Text styles for different purposes.
        </JIIText>
        
        <JIIText variant="h1">Heading 1</JIIText>
        <JIIText variant="h2">Heading 2</JIIText>
        <JIIText variant="h3">Heading 3</JIIText>
        <JIIText variant="h4">Heading 4</JIIText>
        <JIIText variant="h5">Heading 5</JIIText>
        <JIIText variant="h6">Heading 6</JIIText>
        
        <View style={styles.spacer} />
        
        <JIIText variant="lead">
          This is a lead paragraph that introduces a section with important information.
        </JIIText>
        
        <View style={styles.spacer} />
        
        <JIIText variant="body">
          This is regular body text used for the main content. The JII Design System uses Overpass for body text to ensure readability across different screen sizes and devices.
        </JIIText>
        
        <View style={styles.spacer} />
        
        <JIIText variant="bodyMedium">
          This is medium body text that provides slightly more emphasis than regular body text.
        </JIIText>
        
        <View style={styles.spacer} />
        
        <JIIText variant="quote">
          "This is a quote style that can be used for testimonials or important statements that need to stand out."
        </JIIText>
        
        <View style={styles.spacer} />
        
        <JIIText variant="subheader">This is a subheader (Bold)</JIIText>
        <JIIText variant="subheaderExtraBold">This is a subheader (Extra Bold)</JIIText>
        <JIIText variant="subheaderBlack">This is a subheader (Black)</JIIText>
        
        <View style={styles.spacer} />
        
        <JIIText variant="caption">This is caption text used for supplementary information</JIIText>
        <JIIText variant="overline">This is overline text</JIIText>
      </View>
      
      <View style={styles.section}>
        <JIIText variant="h4">Buttons</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Button variants and sizes.
        </JIIText>
        
        <View style={styles.buttonRow}>
          <JIIButton title="Primary" variant="primary" style={styles.button} />
          <JIIButton title="Secondary" variant="secondary" style={styles.button} />
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
          <JIIButton 
            title="Loading" 
            isLoading={true} 
            style={styles.button} 
          />
          <JIIButton 
            title="Disabled" 
            isDisabled={true} 
            style={styles.button} 
          />
        </View>
      </View>
      
      <View style={styles.section}>
        <JIIText variant="h4">Cards</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Card variants for containing content.
        </JIIText>
        
        <JIICard>
          <JIIText variant="h5">Default Card</JIIText>
          <JIIText variant="body">
            This is a default card that can be used to group related content.
          </JIIText>
        </JIICard>
        
        <JIICard variant="elevated">
          <JIIText variant="h5">Elevated Card</JIIText>
          <JIIText variant="body">
            This card has elevation to create a sense of hierarchy.
          </JIIText>
        </JIICard>
        
        <JIICard variant="outlined">
          <JIIText variant="h5">Outlined Card</JIIText>
          <JIIText variant="body">
            This card has an outline instead of a background color.
          </JIIText>
        </JIICard>
      </View>
      
      <View style={styles.section}>
        <JIIText variant="h4">Inputs</JIIText>
        <JIIText variant="bodyMedium" style={styles.sectionDescription}>
          Form input components.
        </JIIText>
        
        <JIIInput 
          label="Standard Input"
          placeholder="Enter text here"
        />
        
        <JIIInput 
          label="With Helper Text"
          placeholder="Enter text here"
          helper="This is helper text that provides additional guidance."
        />
        
        <JIIInput 
          label="With Error"
          placeholder="Enter text here"
          error="This field is required"
          value="Invalid input"
        />
        
        <JIIInput 
          label="With Icon"
          placeholder="Enter your email"
          leftIcon={<Mail size={20} color={theme.isDark ? theme.colors.dark.inactive : theme.colors.light.inactive} />}
        />
        
        <JIIInput 
          label="Password Input"
          placeholder="Enter your password"
          isPassword={true}
        />
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
    flexDirection: 'row',
    marginBottom: 8,
  },
  colorSwatch: {
    flex: 1,
    height: 80,
    marginHorizontal: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  button: {
    margin: 4,
  },
  spacer: {
    height: 16,
  },
});