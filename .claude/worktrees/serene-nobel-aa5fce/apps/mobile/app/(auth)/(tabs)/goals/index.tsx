import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles, Spacing } from '../../../../theme';

export default function GoalsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Goals</Text>
        <Text style={styles.subheading}>Your active goals will appear here.</Text>
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
    padding: Spacing.lg,
  },
  heading: {
    ...TextStyles.h1,
    color: DarkTheme.text.primary,
    marginBottom: Spacing.sm,
  },
  subheading: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
  },
});
