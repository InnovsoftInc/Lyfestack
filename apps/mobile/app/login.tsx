import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../theme';
import { Colors } from '@lyfestack/shared';
import { useAuthStore } from '../stores/auth.store';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    content: { flex: 1, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.xl },
    logoSection: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
    logoMark: { width: 52, height: 52, borderRadius: BorderRadius.md, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
    logoMarkText: { ...TextStyles.h4, color: Colors.white },
    logo: { ...TextStyles.h2, color: theme.text.primary },
    tagline: { ...TextStyles.body, color: theme.text.secondary },
    form: { gap: Spacing.md },
    inputGroup: { gap: Spacing.sm },
    inputLabel: { ...TextStyles.small, color: theme.text.secondary, fontWeight: '600' },
    input: { ...TextStyles.body, color: theme.text.primary, backgroundColor: theme.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border, paddingVertical: 12, paddingHorizontal: Spacing.md },
    loginButton: { backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
    loginButtonDisabled: { opacity: 0.4 },
    loginButtonText: { ...TextStyles.button, color: Colors.white, fontSize: 17 },
    errorText: { ...TextStyles.small, color: '#EF4444', textAlign: 'center' },
    divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
    dividerText: { ...TextStyles.caption, color: theme.text.secondary },
    signupLink: { alignItems: 'center', paddingVertical: Spacing.md },
    signupText: { ...TextStyles.body, color: theme.text.secondary },
    signupHighlight: { color: Colors.accent, fontWeight: '600' },
    forgotText: { ...TextStyles.small, color: Colors.accent, textAlign: 'right', marginTop: -Spacing.xs },
  });
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const handleLogin = async () => {
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <View style={styles.logoSection}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>LS</Text>
            </View>
            <Text style={styles.logo}>Lyfestack</Text>
            <Text style={styles.tagline}>Welcome back</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.text.secondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.text.secondary}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, (!email || !password || isLoading) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={!email || !password || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/onboarding')}>
            <Text style={styles.signupText}>
              Don't have an account? <Text style={styles.signupHighlight}>Get Started</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
