import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { DarkTheme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>Lyfestack</Text>
        <Text style={styles.tagline}>Stack your days.{'\n'}Build your lyfe.</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(auth)/(tabs)/dashboard')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  logo: {
    ...TextStyles.h1,
    color: Colors.skyBlue,
  },
  tagline: {
    ...TextStyles.h3,
    color: DarkTheme.text.secondary,
    lineHeight: 36,
  },
  button: {
    backgroundColor: Colors.skyBlue,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  buttonText: {
    ...TextStyles.button,
    color: Colors.white,
  },
});
