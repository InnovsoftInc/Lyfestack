import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { getTemplates } from '../../services/templates.api';
import type { TemplateDefinition } from '../../services/templates.api';

const CATEGORY_EMOJI: Record<string, string> = {
  FITNESS: '💪',
  FINANCE: '💰',
  CAREER: '🚀',
  CREATIVITY: '🎨',
  RELATIONSHIPS: '❤️',
  HEALTH: '🌿',
  PRODUCTIVITY: '⚡',
  LEARNING: '📚',
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    header: {
      padding: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    backText: {
      ...TextStyles.body,
      color: Colors.accent,
      marginBottom: Spacing.md,
    },
    title: {
      ...TextStyles.h2,
      color: theme.text.primary,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...TextStyles.body,
      color: theme.text.secondary,
    },
    list: {
      padding: Spacing.lg,
      paddingTop: Spacing.sm,
      gap: Spacing.sm,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    emoji: {
      fontSize: 32,
      width: 44,
    },
    cardBody: {
      flex: 1,
    },
    cardTitle: {
      ...TextStyles.h4,
      color: theme.text.primary,
      marginBottom: 2,
    },
    cardDesc: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      marginBottom: Spacing.xs,
    },
    cardMeta: {
      ...TextStyles.caption,
      color: Colors.accent,
      fontWeight: '600',
    },
    chevron: {
      ...TextStyles.h3,
      color: theme.text.secondary,
    },
    errorText: {
      ...TextStyles.body,
      color: theme.error,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    retryButton: {
      backgroundColor: Colors.accent,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
    },
    retryText: {
      ...TextStyles.button,
      color: Colors.white,
    },
  });
}

export default function TemplatePicker() {
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Failed to load templates';
        setError(msg);
      })
      .finally(() => setIsLoading(false));
  }, []);

  function handleSelect(template: TemplateDefinition) {
    router.push({
      pathname: '/goal-setup/diagnostic',
      params: { templateId: template.id, templateName: template.name },
    });
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose a Goal Type</Text>
        <Text style={styles.subtitle}>Pick a template to get started</Text>
      </View>

      <FlatList
        data={templates}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)} activeOpacity={0.8}>
            <View style={styles.cardRow}>
              <Text style={styles.emoji}>
                {CATEGORY_EMOJI[item.category] ?? '🎯'}
              </Text>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.cardMeta}>{item.durationDays} days</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
