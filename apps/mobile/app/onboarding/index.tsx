import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { DarkTheme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>LS</Text>
          </View>
          <Text style={styles.logo}>Lyfestack</Text>
          <Text style={styles.tagline}>Stack your days.{'\n'}Build your lyfe.</Text>
          <Text style={styles.subtitle}>
            Your AI-powered life operating system — goals, tasks, and automations that
            work for you.
          </Text>
        </View>

        <View style={styles.features}>
          {[
            { icon: '⚡', text: 'Daily briefs generated every morning' },
            { icon: '🎯', text: 'AI agents handle the tedious work' },
            { icon: '📈', text: 'Track momentum across all your goals' },
          ].map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/onboarding/goals')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/(tabs)/dashboard')}
            activeOpacity={0.7}
          >
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.background,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    marginTop: height * 0.06,
    gap: Spacing.md,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  logoMarkText: {
    ...TextStyles.h4,
    color: Colors.white,
  },
  logo: {
    ...TextStyles.h1,
    color: DarkTheme.text.primary,
  },
  tagline: {
    ...TextStyles.h3,
    color: Colors.accent,
    lineHeight: 36,
  },
  subtitle: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    lineHeight: 26,
    marginTop: Spacing.sm,
  },
  features: {
    gap: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  featureIcon: {
    fontSize: 22,
  },
  featureText: {
    ...TextStyles.bodyMedium,
    color: DarkTheme.text.primary,
    flex: 1,
  },
  actions: {
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...TextStyles.button,
    color: Colors.white,
    fontSize: 17,
  },
  signInText: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    textAlign: 'center',
  },
});
