import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DarkTheme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useAuthStore } from '../../stores/auth.store';

export default function AuthScreen() {
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'options' | 'email' | 'login'>(initialMode === 'login' ? 'login' : 'options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { signup, login, isLoading, error, confirmationPending } = useAuthStore();

  const handleEmailSignup = async () => {
    if (!email || !password) return;
    try {
      await signup(email, password, name || undefined);
      // confirmationPending is set synchronously in the store before this resolves
      const pending = useAuthStore.getState().confirmationPending;
      if (!pending) {
        router.replace('/(auth)/(drawer)/dashboard');
      }
    } catch {
      // error shown via store
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) return;
    try {
      await login(email, password);
      router.replace('/(auth)/(drawer)/dashboard');
    } catch {
      // error shown via store
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
          {confirmationPending ? (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationIcon}>✉️</Text>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We sent a confirmation link to{' '}
                <Text style={styles.emailHighlight}>{email}</Text>. Click the
                link to activate your account, then come back to log in.
              </Text>
              <TouchableOpacity
                style={[styles.continueButton, { marginTop: Spacing.xl }]}
                onPress={() => setMode('login')}
              >
                <Text style={styles.continueText}>Go to Log In</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in to continue your goals.'
                : 'Your plan is ready. Sign up to unlock it and start your first daily brief tomorrow morning.'}
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {mode === 'options' ? (
            <View style={styles.authOptions}>
              <TouchableOpacity
                style={styles.emailButton}
                onPress={() => setMode('email')}
                activeOpacity={0.85}
              >
                <Text style={styles.emailButtonText}>Sign up with Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.emailButton, styles.loginButton]}
                onPress={() => setMode('login')}
                activeOpacity={0.85}
              >
                <Text style={[styles.emailButtonText, styles.loginButtonText]}>Log in</Text>
              </TouchableOpacity>
            </View>
          ) : mode === 'email' ? (
            <View style={styles.emailForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={DarkTheme.text.secondary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
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
                style={[styles.continueButton, (!(email && password) || isLoading) && styles.continueButtonDisabled]}
                onPress={handleEmailSignup}
                disabled={!(email && password) || isLoading}
                activeOpacity={0.85}
              >
                {isLoading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.continueText}>Create Account</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setMode('options')}>
                <Text style={styles.backToOptions}>← Other options</Text>
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
                  placeholder="Password"
                  placeholderTextColor={DarkTheme.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.continueButton, (!(email && password) || isLoading) && styles.continueButtonDisabled]}
                onPress={handleEmailLogin}
                disabled={!(email && password) || isLoading}
                activeOpacity={0.85}
              >
                {isLoading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.continueText}>Log In</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setMode('options')}>
                <Text style={styles.backToOptions}>← Back</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.legal}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
          </>
          )}
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
  content: { flex: 1, padding: Spacing.xl, gap: Spacing.xl },
  titleSection: { gap: Spacing.sm },
  title: { ...TextStyles.h2, color: DarkTheme.text.primary },
  subtitle: { ...TextStyles.body, color: DarkTheme.text.secondary, lineHeight: 26 },
  errorText: { ...TextStyles.small, color: '#EF4444', textAlign: 'center' },
  authOptions: { gap: Spacing.md },
  emailButton: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: DarkTheme.surface,
  },
  emailButtonText: { ...TextStyles.bodyMedium, color: DarkTheme.text.primary },
  loginButtonText: { color: DarkTheme.text.secondary },
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
  confirmationBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  confirmationIcon: { fontSize: 56 },
  emailHighlight: { color: Colors.accent, fontWeight: '600' },
});
