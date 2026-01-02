import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useHistoryStore } from '@/stores';
import { formatDate, formatDuration } from '@/utils';

function getRpeColor(value: number): string {
  if (value <= 3) return colors.success;
  if (value <= 6) return colors.warning;
  if (value <= 8) return colors.accent;
  return colors.error;
}

function getRpeLabel(value: number): string {
  if (value <= 2) return 'Very Easy';
  if (value <= 4) return 'Easy';
  if (value <= 6) return 'Moderate';
  if (value <= 8) return 'Hard';
  return 'Maximum';
}

export default function EditFeedbackScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const insets = useSafeAreaInsets();

  const getSessionById = useHistoryStore((state) => state.getSessionById);
  const updateSession = useHistoryStore((state) => state.updateSession);

  const session = sessionId ? getSessionById(sessionId) : undefined;

  const [rpe, setRpe] = useState<number | undefined>(session?.feedback?.rpe);
  const [notes, setNotes] = useState(session?.feedback?.notes || '');

  useEffect(() => {
    if (session) {
      setRpe(session.feedback?.rpe);
      setNotes(session.feedback?.notes || '');
    }
  }, [session]);

  const handleSave = () => {
    if (sessionId) {
      updateSession(sessionId, {
        rpe,
        notes: notes.trim() || undefined,
      });
    }
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Session not found</Text>
        <Button title="Go Back" onPress={handleCancel} />
      </View>
    );
  }

  const workout = session.workout;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Feedback</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Workout Info */}
        <Card style={styles.workoutCard}>
          <Text style={styles.workoutName}>{workout.name}</Text>
          <View style={styles.workoutMeta}>
            <Text style={styles.workoutDate}>
              {formatDate(session.completedAt || session.startedAt || workout.createdAt)}
            </Text>
            <Text style={styles.workoutDuration}>
              {formatDuration(session.actualDurationWorked)}
            </Text>
          </View>
        </Card>

        {/* RPE Input */}
        <Card style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>How did it feel?</Text>
          <Text style={styles.feedbackSubtitle}>Rate your perceived exertion</Text>

          <View style={styles.rpeContainer}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.rpeButton,
                  {
                    backgroundColor:
                      rpe === value ? getRpeColor(value) : getRpeColor(value) + '30',
                    borderColor: rpe === value ? getRpeColor(value) : 'transparent',
                  },
                ]}
                onPress={() => setRpe(rpe === value ? undefined : value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.rpeText,
                    { color: rpe === value ? colors.text : getRpeColor(value) },
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.rpeLabels}>
            <Text style={styles.rpeLabel}>Easy</Text>
            <Text style={styles.rpeLabel}>Moderate</Text>
            <Text style={styles.rpeLabel}>Maximum</Text>
          </View>

          {rpe !== undefined && (
            <View style={styles.rpeSelectedContainer}>
              <Text style={[styles.rpeSelectedText, { color: getRpeColor(rpe) }]}>
                RPE {rpe}: {getRpeLabel(rpe)}
              </Text>
            </View>
          )}
        </Card>

        {/* Notes Input */}
        <Card style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>Notes</Text>
          <Text style={styles.feedbackSubtitle}>
            Record how you felt, any issues, or thoughts
          </Text>
          <Input
            placeholder="e.g., Felt strong today, shoulder was tight..."
            value={notes}
            onChangeText={setNotes}
            multiline
            containerStyle={styles.notesInput}
          />
        </Card>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Button title="Save Changes" onPress={handleSave} size="lg" fullWidth />
        <Button
          title="Cancel"
          onPress={handleCancel}
          variant="outline"
          size="lg"
          fullWidth
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  workoutCard: {
    marginBottom: spacing.lg,
  },
  workoutName: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  workoutDate: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  workoutDuration: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  feedbackCard: {
    marginBottom: spacing.lg,
  },
  feedbackTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  feedbackSubtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  rpeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  rpeButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  rpeText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  rpeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  rpeLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  rpeSelectedContainer: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  rpeSelectedText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  notesInput: {
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: typography.base,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
