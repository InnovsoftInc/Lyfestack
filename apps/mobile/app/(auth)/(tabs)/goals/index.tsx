import { useEffect } from 'react';
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
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useGoalsStore } from '../../../../stores/goals.store';
import type { Goal } from '../../../../services/goals.api';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: Colors.success,
  PAUSED: Colors.warning,
  COMPLETED: Colors.accent,
  ARCHIVED: Colors.gray500 ?? '#6B7280',
};

export default function GoalsScreen() {
  const { goals, isLoading, error, fetchGoals } = useGoalsStore();

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  function renderGoal({ item }: { item: Goal }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View style={styles.cardMeta}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] ?? Colors.gray500 }]} />
              <Text style={styles.statusText}>{item.status}</Text>
              {item.targetDate && (
                <Text style={styles.dateText}> · Due {item.targetDate}</Text>
              )}
            </View>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>{item.progressScore}%</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Goals</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/goal-setup')}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {isLoading && goals.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void fetchGoals()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : goals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyTitle}>No goals yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your first goal to get a personalized daily plan
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/goal-setup')}
          >
            <Text style={styles.ctaText}>Set First Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          renderItem={renderGoal}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  heading: {
    ...TextStyles.h1,
    color: DarkTheme.text.primary,
  },
  addButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    ...TextStyles.button,
    color: Colors.white,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    ...TextStyles.h4,
    color: DarkTheme.text.primary,
    marginBottom: 2,
  },
  cardDesc: {
    ...TextStyles.small,
    color: DarkTheme.text.secondary,
    marginBottom: Spacing.xs,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
    textTransform: 'capitalize',
  },
  dateText: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
  },
  progressBadge: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    ...TextStyles.caption,
    color: Colors.accent,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...TextStyles.h3,
    color: DarkTheme.text.primary,
  },
  emptySubtitle: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    textAlign: 'center',
  },
  ctaButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  ctaText: {
    ...TextStyles.button,
    color: Colors.white,
  },
  errorText: {
    ...TextStyles.body,
    color: DarkTheme.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  retryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  retryText: {
    ...TextStyles.button,
    color: DarkTheme.text.secondary,
  },
});
