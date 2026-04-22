import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { DarkTheme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';

export default function AuthScreen() {
  const [mode, setMode] = useState<'options' | 'email'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSocialAuth = (provider: 'google' | 'apple') => {
    // TODO: wire to Supabase OAuth
    console.log(`Auth with ${provider}`);
    router.replace('/(auth)/(tabs)/dashboard');
  };

  const handleEmailAuth = () => {
    // TODO: wire to Supabase email auth
    if (email && password) {
      router.replace('/(auth)/(tabs)/dashboard');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.progress}>
            {[1, 2, 3, 4].map((step) => (
              <View key={step} style={[styles.progressDot, styles.progressDotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Your plan is ready. Sign up to unlock it and start your first daily brief tomorrow morning.
            </Text>
          </View>

          {mode === 'options' ? (
            <View style={styles.authOptions}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialAuth('google')}
                activeOpacity={0.85}
              >
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialAuth('apple')}
                activeOpacity={0.85}
              >
                <Text style={styles.socialIcon}>󰀵</Text>
                <Text style={styles.socialText}>Continue with Apple</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.emailButton}
                onPress={() => setMode('email')}
                activeOpacity={0.85}
              >
                <Text style={styles.emailButtonText}>Continue with Email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emailForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={DarkTheme.text.secondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={DarkTheme.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.continueButton, !(email && password) && styles.continueButtonDisabled]}
                onPress={handleEmailAuth}
                disabled={!(email && password)}
                activeOpacity={0.85}
              >
                <Text style={styles.continueText}>Create Account</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setMode('options')}>
                <Text style={styles.backToOptions}>← Other sign-up options</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.legal}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: Spacing.xs },
  backText: { ...TextStyles.bodyMedium, color: DarkTheme.text.secondary },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DarkTheme.border },
  progressDotActive: { backgroundColor: Colors.accent, width: 20 },
  content: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  titleSection: { gap: Spacing.sm },
  title: { ...TextStyles.h2, color: DarkTheme.text.primary },
  subtitle: { ...TextStyles.body, color: DarkTheme.text.secondary, lineHeight: 26 },
  authOptions: { gap: Spacing.md },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DarkTheme.text.primary,
    width: 24,
    textAlign: 'center',
  },
  socialText: { ...TextStyles.bodyMedium, color: DarkTheme.text.primary },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: DarkTheme.border },
  dividerText: { ...TextStyles.small, color: DarkTheme.text.secondary },
  emailButton: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  emailButtonText: { ...TextStyles.bodyMedium, color: DarkTheme.text.primary },
  emailForm: { gap: Spacing.md },
  inputGroup: { gap: Spacing.sm },
  inputLabel: { ...TextStyles.small, color: DarkTheme.text.secondary, fontWeight: '600' },
  input: {
    ...TextStyles.body,
    color: DarkTheme.text.primary,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  continueButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  continueButtonDisabled: { opacity: 0.4 },
  continueText: { ...TextStyles.button, color: Colors.white, fontSize: 17 },
  backToOptions: {
    ...TextStyles.small,
    color: DarkTheme.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  legal: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 'auto',
  },
});
