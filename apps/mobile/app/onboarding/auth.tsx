import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useGoalsStore } from '../../stores/goals.store';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    backButton: { padding: Spacing.xs },
    backText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    progress: { flexDirection: 'row', gap: 6 },
    progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border },
    progressDotActive: { backgroundColor: Colors.accent, width: 20 },
    content: { flex: 1, padding: Spacing.xl, gap: Spacing.xl },
    titleSection: { gap: Spacing.sm },
    title: { ...TextStyles.h2, color: theme.text.primary },
    subtitle: { ...TextStyles.body, color: theme.text.secondary, lineHeight: 26 },
    errorText: { ...TextStyles.small, color: '#EF4444', textAlign: 'center' },
    authOptions: { gap: Spacing.md },
    emailButton: {
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
      alignItems: 'center',
    },
    loginButton: {
      backgroundColor: theme.surface,
    },
    emailButtonText: { ...TextStyles.bodyMedium, color: theme.text.primary },
    loginButtonText: { color: theme.text.secondary },
    emailForm: { gap: Spacing.md },
    inputGroup: { gap: Spacing.sm },
    inputLabel: { ...TextStyles.small, color: theme.text.secondary, fontWeight: '600' },
    input: {
      ...TextStyles.body,
      color: theme.text.primary,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 12,
      paddingHorizontal: Spacing.md,
    },
    passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border },
    passwordInput: { ...TextStyles.body, color: theme.text.primary, flex: 1, paddingVertical: 12, paddingHorizontal: Spacing.md },
    eyeButton: { paddingHorizontal: Spacing.md, paddingVertical: 12 },
    eyeText: { ...TextStyles.small, color: theme.text.secondary, fontWeight: '600' },
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
      color: theme.text.secondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    legal: {
      ...TextStyles.caption,
      color: theme.text.secondary,
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
}

export default function AuthScreen() {
  const [mode, setMode] = useState<'options' | 'email'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signup, login, isLoading, error, confirmationPending, isAuthenticated, isRestoring } = useAuthStore();
  const { selectedTemplateId, diagnosticAnswers, reset: resetOnboarding } = useOnboardingStore();
  const { createGoal } = useGoalsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const createGoalFromOnboarding = async () => {
    if (selectedTemplateId) {
      try {
        const templateNames: Record<string, string> = {
          'productivity': 'Personal Productivity',
          'self-improvement': 'Self Improvement',
          'solo-business': 'Solo Business Growth',
          'social-media': 'Social Media Growth',
          'fitness': 'Fitness & Health',
        };
        // Map onboarding template slugs to server template registry IDs
        const serverTemplateIds: Record<string, string> = {
          'productivity': 'tpl-productivity-focus',
          'fitness': 'tpl-fitness-beginner',
          'solo-business': 'tpl-solo-business',
        };
        const answers = Object.entries(diagnosticAnswers).map(([questionId, value]) => ({
          questionId,
          value,
        }));
        await createGoal({
          title: templateNames[selectedTemplateId] ?? selectedTemplateId,
          description: `Goal created from ${templateNames[selectedTemplateId] ?? selectedTemplateId} template`,
          ...(serverTemplateIds[selectedTemplateId] && { templateId: serverTemplateIds[selectedTemplateId] }),
          diagnosticAnswers: answers,
        });
        resetOnboarding();
      } catch {
        // Goal creation failed — user can create manually from Goals tab
      }
    }
  };

  const handleEmailSignup = async () => {
    if (!email || !password) return;
    try {
      await signup(email, password, name || undefined);
      const pending = useAuthStore.getState().confirmationPending;
      if (!pending) {
        await createGoalFromOnboarding();
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
      await createGoalFromOnboarding();
      router.replace('/(auth)/(drawer)/dashboard');
    } catch {
      // error shown via store
    }
  };

  if (!isRestoring && isAuthenticated) {
    return <Redirect href="/(auth)/(drawer)/dashboard" />;
  }

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
                onPress={() => router.push('/login')}
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
                onPress={() => router.push('/login')}
                activeOpacity={0.85}
              >
                <Text style={[styles.emailButtonText, styles.loginButtonText]}>Already have an account? Sign in</Text>
              </TouchableOpacity>
            </View>
          ) : mode === 'email' ? (
            <View style={styles.emailForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={theme.text.secondary}
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
                  placeholderTextColor={theme.text.secondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Min. 8 characters"
                    placeholderTextColor={theme.text.secondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(v => !v)}>
                    <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
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
                  placeholderTextColor={theme.text.secondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Password"
                    placeholderTextColor={theme.text.secondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(v => !v)}>
                    <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
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
