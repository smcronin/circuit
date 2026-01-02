import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/common';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useHistoryStore, useWeightStore, useUserStore } from '@/stores';
import { WeightEntry } from '@/types/workout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper functions
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getDaysInMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

const formatMonthYear = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// Mini bar chart component
const MiniBarChart = ({
  data,
  maxValue,
  color,
  height = 80,
}: {
  data: number[];
  maxValue: number;
  color: string;
  height?: number;
}) => {
  const barWidth = Math.floor((SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2 - spacing.xs * 6) / 7);

  return (
    <View style={[styles.miniChart, { height }]}>
      {data.map((value, index) => {
        const barHeight = maxValue > 0 ? (value / maxValue) * (height - 20) : 0;
        return (
          <View key={index} style={styles.barContainer}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(barHeight, value > 0 ? 4 : 0),
                  backgroundColor: value > 0 ? color : colors.surfaceLight,
                  width: barWidth,
                },
              ]}
            />
            <Text style={styles.barLabel}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'][index]}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// Helper to get date string in local timezone
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get last 7 days as date strings
const getLast7Days = (): string[] => {
  const days: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push(getLocalDateString(date));
  }
  return days;
};

// Helper to format date for display
const formatShortDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Weight graph component
const WeightGraph = ({
  entries,
  showFullHistory,
  onToggleHistory,
}: {
  entries: WeightEntry[];
  showFullHistory: boolean;
  onToggleHistory: () => void;
}) => {
  // Deduplicate entries by date - keep only last entry per day
  const entriesByDate = useMemo(() => {
    const byDate: Record<string, WeightEntry> = {};
    // Sort oldest first so newer entries overwrite older ones
    const sorted = [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    sorted.forEach((entry) => {
      const dateStr = getLocalDateString(new Date(entry.date));
      byDate[dateStr] = entry;
    });
    return byDate;
  }, [entries]);

  // Get data points based on view mode
  const dataPoints = useMemo(() => {
    if (showFullHistory) {
      // Show all unique dates with data
      return Object.entries(entriesByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30) // Max 30 days for full history
        .map(([date, entry]) => ({ date, weight: entry.weight }));
    } else {
      // Show last 7 days
      const last7 = getLast7Days();
      return last7.map((date) => ({
        date,
        weight: entriesByDate[date]?.weight ?? null,
      }));
    }
  }, [entriesByDate, showFullHistory]);

  // Filter to only points with data for graph drawing
  const pointsWithData = dataPoints.filter((p) => p.weight !== null) as {
    date: string;
    weight: number;
  }[];

  if (pointsWithData.length === 0) {
    return (
      <View style={styles.emptyGraph}>
        <Text style={styles.emptyGraphText}>No weight data yet</Text>
        <Text style={styles.emptyGraphSubtext}>Tap + to log your weight</Text>
      </View>
    );
  }

  const weights = pointsWithData.map((p) => p.weight);
  const minWeight = Math.min(...weights) - 2;
  const maxWeight = Math.max(...weights) + 2;
  const range = maxWeight - minWeight || 1;

  const graphWidth = SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2 - 40;
  const graphHeight = 100;

  return (
    <View>
      <View style={styles.graphWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text style={styles.axisLabel}>{maxWeight.toFixed(0)}</Text>
          <Text style={styles.axisLabel}>{((maxWeight + minWeight) / 2).toFixed(0)}</Text>
          <Text style={styles.axisLabel}>{minWeight.toFixed(0)}</Text>
        </View>

        {/* Graph area */}
        <View style={[styles.graphArea, { height: graphHeight }]}>
          {/* Grid lines */}
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: graphHeight / 2 }]} />
          <View style={[styles.gridLine, { bottom: 0 }]} />

          {/* Lines connecting points */}
          {pointsWithData.length > 1 &&
            pointsWithData.slice(0, -1).map((point, index) => {
              const nextPoint = pointsWithData[index + 1];
              const x1Index = dataPoints.findIndex((p) => p.date === point.date);
              const x2Index = dataPoints.findIndex((p) => p.date === nextPoint.date);
              const pointSpacing = graphWidth / Math.max(dataPoints.length - 1, 1);

              const x1 = x1Index * pointSpacing;
              const y1 = graphHeight - ((point.weight - minWeight) / range) * graphHeight;
              const x2 = x2Index * pointSpacing;
              const y2 = graphHeight - ((nextPoint.weight - minWeight) / range) * graphHeight;
              const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
              const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

              return (
                <View
                  key={point.date}
                  style={[
                    styles.graphLine,
                    {
                      left: x1,
                      top: y1,
                      width: length,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              );
            })}

          {/* Points */}
          {pointsWithData.map((point) => {
            const xIndex = dataPoints.findIndex((p) => p.date === point.date);
            const pointSpacing = graphWidth / Math.max(dataPoints.length - 1, 1);
            const x = xIndex * pointSpacing;
            const y = graphHeight - ((point.weight - minWeight) / range) * graphHeight;
            return (
              <View
                key={point.date}
                style={[
                  styles.graphPoint,
                  { left: x - 5, top: y - 5 },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* X-axis date labels */}
      <View style={styles.xAxisLabels}>
        <View style={{ width: 36 }} />
        {dataPoints.map((point, index) => {
          // Show fewer labels if many points
          const showLabel = dataPoints.length <= 7 || index % Math.ceil(dataPoints.length / 7) === 0 || index === dataPoints.length - 1;
          return (
            <View key={point.date} style={styles.xAxisLabelContainer}>
              {showLabel && (
                <Text style={styles.xAxisLabel}>
                  {new Date(point.date + 'T12:00:00').getDate()}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Toggle button */}
      <TouchableOpacity style={styles.historyToggle} onPress={onToggleHistory}>
        <Text style={styles.historyToggleText}>
          {showFullHistory ? 'Show Last 7 Days' : 'Show Full History'}
        </Text>
        <Ionicons
          name={showFullHistory ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
};

// Calendar widget
const CalendarWidget = ({
  exerciseDays,
  currentMonth,
  onPrevMonth,
  onNextMonth,
}: {
  exerciseDays: Set<string>;
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) => {
  const daysInMonth = getDaysInMonth(currentMonth);
  const startOfMonth = getStartOfMonth(currentMonth);
  const startDay = startOfMonth.getDay();
  const today = new Date();

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const isExerciseDay = (day: number): boolean => {
    // Use local date string format to avoid timezone issues
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    return exerciseDays.has(dateStr);
  };

  const isToday = (day: number): boolean => {
    return (
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getDate() === day
    );
  };

  return (
    <View>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.calendarNav}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.calendarTitle}>{formatMonthYear(currentMonth)}</Text>
        <TouchableOpacity onPress={onNextMonth} style={styles.calendarNav}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarDaysHeader}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <Text key={i} style={styles.calendarDayHeader}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {days.map((day, index) => (
          <View key={index} style={styles.calendarDayContainer}>
            {day && (
              <View
                style={[
                  styles.calendarDay,
                  isExerciseDay(day) && styles.calendarDayExercise,
                  isToday(day) && styles.calendarDayToday,
                ]}
              >
                {isExerciseDay(day) ? (
                  <Ionicons name="checkmark" size={16} color={colors.success} />
                ) : (
                  <Text
                    style={[
                      styles.calendarDayText,
                      isToday(day) && styles.calendarDayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const history = useHistoryStore((state) => state.history);
  const weightEntries = useWeightStore((state) => state.entries);
  const addWeightEntry = useWeightStore((state) => state.addEntry);
  const getEntryForDate = useWeightStore((state) => state.getEntryForDate);
  const profile = useUserStore((state) => state.profile);
  const updateProfile = useUserStore((state) => state.updateProfile);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [showFullWeightHistory, setShowFullWeightHistory] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [existingWeight, setExistingWeight] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const weightUnit = profile?.weightUnit || 'lbs';

  // Combine profile weight with weight entries for display
  const allWeightEntries = useMemo(() => {
    // If we have weight entries, use them
    if (weightEntries.length > 0) {
      return weightEntries;
    }
    // If no entries but profile has weight, create a virtual entry
    if (profile?.weight) {
      return [{
        id: 'profile-initial',
        date: profile.createdAt || new Date().toISOString(),
        weight: profile.weight,
        unit: profile.weightUnit,
      }];
    }
    return [];
  }, [weightEntries, profile?.weight, profile?.createdAt, profile?.weightUnit]);

  // Calculate exercise days for calendar
  const exerciseDays = useMemo(() => {
    const days = new Set<string>();
    history.sessions
      .filter((s) => s.status === 'completed' || s.status === 'stopped_early')
      .forEach((session) => {
        const date = new Date(session.completedAt || session.startedAt || session.workout.createdAt);
        // Use local date string to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        days.add(`${year}-${month}-${day}`);
      });
    return days;
  }, [history.sessions]);

  // Calculate this week's data
  const weeklyData = useMemo(() => {
    const startOfWeek = getStartOfWeek(new Date());
    const days = Array(7).fill(0);
    const calories = Array(7).fill(0);
    const minutes = Array(7).fill(0);

    history.sessions
      .filter((s) => s.status === 'completed' || s.status === 'stopped_early')
      .forEach((session) => {
        const date = new Date(session.completedAt || session.startedAt || session.workout.createdAt);
        const dayOfWeek = date.getDay();
        const sessionStart = new Date(date);
        sessionStart.setHours(0, 0, 0, 0);

        if (sessionStart >= startOfWeek) {
          days[dayOfWeek]++;
          calories[dayOfWeek] += session.estimatedCaloriesBurned;
          minutes[dayOfWeek] += Math.round(session.actualDurationWorked / 60);
        }
      });

    return { days, calories, minutes };
  }, [history.sessions]);

  // Calculate this month's stats
  const monthlyStats = useMemo(() => {
    const startOfMonth = getStartOfMonth(currentMonth);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

    let workouts = 0;
    let totalCalories = 0;
    let totalMinutes = 0;
    let totalRpe = 0;
    let rpeCount = 0;

    history.sessions
      .filter((s) => s.status === 'completed' || s.status === 'stopped_early')
      .forEach((session) => {
        const date = new Date(session.completedAt || session.startedAt || session.workout.createdAt);
        if (date >= startOfMonth && date <= endOfMonth) {
          workouts++;
          totalCalories += session.estimatedCaloriesBurned;
          totalMinutes += Math.round(session.actualDurationWorked / 60);
          if (session.feedback?.rpe) {
            totalRpe += session.feedback.rpe;
            rpeCount++;
          }
        }
      });

    const daysInMonth = getDaysInMonth(currentMonth);
    const targetYear = currentMonth.getFullYear();
    const targetMonth = currentMonth.getMonth() + 1;
    const uniqueDays = Array.from(exerciseDays).filter((d) => {
      // d is in format YYYY-MM-DD
      const [year, month] = d.split('-').map(Number);
      return year === targetYear && month === targetMonth;
    }).length;

    return {
      workouts,
      totalCalories,
      totalMinutes,
      avgRpe: rpeCount > 0 ? (totalRpe / rpeCount).toFixed(1) : '-',
      activeDays: uniqueDays,
      completionRate: Math.round((uniqueDays / daysInMonth) * 100),
    };
  }, [history.sessions, currentMonth, exerciseDays]);

  // Current weight display (from entries or profile)
  const currentWeight = useMemo(() => {
    if (weightEntries.length > 0) {
      return weightEntries[0].weight;
    }
    return profile?.weight || null;
  }, [weightEntries, profile?.weight]);

  // Weight change calculation
  const weightChange = useMemo(() => {
    if (allWeightEntries.length < 2) return null;

    const latest = allWeightEntries[0];
    const oldest = allWeightEntries[allWeightEntries.length - 1];
    const change = latest.weight - oldest.weight;
    const days = Math.ceil(
      (new Date(latest.date).getTime() - new Date(oldest.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    return { change, days };
  }, [allWeightEntries]);

  // Muscle group distribution
  const muscleGroupStats = useMemo(() => {
    const groups: Record<string, number> = {};

    history.sessions
      .filter((s) => s.status === 'completed')
      .slice(0, 20) // Last 20 workouts
      .forEach((session) => {
        session.workout.muscleGroupsTargeted.forEach((group) => {
          groups[group] = (groups[group] || 0) + 1;
        });
      });

    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [history.sessions]);

  const handleAddWeight = () => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) return;

    // Check if there's already an entry for the selected date
    const existingEntry = getEntryForDate(selectedDate);

    if (existingEntry && !showOverwriteConfirm) {
      // Show confirmation modal
      setExistingWeight(existingEntry.weight);
      setShowOverwriteConfirm(true);
      return;
    }

    const entry: WeightEntry = {
      id: Date.now().toString(),
      date: selectedDate.toISOString(),
      weight,
      unit: weightUnit,
    };

    addWeightEntry(entry);
    // Also update the user profile weight if logging for today
    const today = new Date();
    const isToday = getLocalDateString(selectedDate) === getLocalDateString(today);
    if (isToday) {
      updateProfile({ weight });
    }
    setNewWeight('');
    setShowWeightModal(false);
    setShowOverwriteConfirm(false);
    setExistingWeight(null);
    setSelectedDate(new Date());
    setShowDatePicker(false);
  };

  const handleOpenWeightModal = () => {
    setSelectedDate(new Date());
    setNewWeight('');
    setShowOverwriteConfirm(false);
    setExistingWeight(null);
    setShowDatePicker(false);
    setShowWeightModal(true);
  };

  const handleCloseWeightModal = () => {
    setNewWeight('');
    setShowWeightModal(false);
    setShowOverwriteConfirm(false);
    setExistingWeight(null);
    setSelectedDate(new Date());
    setShowDatePicker(false);
  };

  const formatDisplayDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (getLocalDateString(date) === getLocalDateString(today)) {
      return 'Today';
    } else if (getLocalDateString(date) === getLocalDateString(yesterday)) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRecentDates = (): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date);
    }
    return dates;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Analytics</Text>

        {/* Monthly Overview */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Monthly Overview</Text>
          </View>

          <View style={styles.monthlyStatsGrid}>
            <View style={styles.monthlyStatItem}>
              <Text style={styles.monthlyStatValue}>{monthlyStats.workouts}</Text>
              <Text style={styles.monthlyStatLabel}>Workouts</Text>
            </View>
            <View style={styles.monthlyStatItem}>
              <Text style={styles.monthlyStatValue}>{monthlyStats.activeDays}</Text>
              <Text style={styles.monthlyStatLabel}>Active Days</Text>
            </View>
            <View style={styles.monthlyStatItem}>
              <Text style={styles.monthlyStatValue}>{monthlyStats.completionRate}%</Text>
              <Text style={styles.monthlyStatLabel}>Consistency</Text>
            </View>
            <View style={styles.monthlyStatItem}>
              <Text style={styles.monthlyStatValue}>{monthlyStats.avgRpe}</Text>
              <Text style={styles.monthlyStatLabel}>Avg RPE</Text>
            </View>
          </View>

          <CalendarWidget
            exerciseDays={exerciseDays}
            currentMonth={currentMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        </Card>

        {/* Weekly Stats */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up-outline" size={20} color={colors.accent} />
            <Text style={styles.sectionTitle}>This Week</Text>
          </View>

          <View style={styles.weeklyStats}>
            <View style={styles.weeklyStatRow}>
              <Text style={styles.weeklyStatLabel}>Workouts</Text>
              <Text style={styles.weeklyStatValue}>
                {weeklyData.days.reduce((a, b) => a + b, 0)}
              </Text>
            </View>
            <MiniBarChart
              data={weeklyData.days}
              maxValue={Math.max(...weeklyData.days, 1)}
              color={colors.primary}
            />
          </View>

          <View style={styles.weeklyStats}>
            <View style={styles.weeklyStatRow}>
              <Text style={styles.weeklyStatLabel}>Calories</Text>
              <Text style={styles.weeklyStatValue}>
                {weeklyData.calories.reduce((a, b) => a + b, 0)}
              </Text>
            </View>
            <MiniBarChart
              data={weeklyData.calories}
              maxValue={Math.max(...weeklyData.calories, 1)}
              color={colors.accent}
            />
          </View>

          <View style={styles.weeklyStats}>
            <View style={styles.weeklyStatRow}>
              <Text style={styles.weeklyStatLabel}>Minutes</Text>
              <Text style={styles.weeklyStatValue}>
                {weeklyData.minutes.reduce((a, b) => a + b, 0)}
              </Text>
            </View>
            <MiniBarChart
              data={weeklyData.minutes}
              maxValue={Math.max(...weeklyData.minutes, 1)}
              color={colors.success}
            />
          </View>
        </Card>

        {/* Weight Tracker */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="scale-outline" size={20} color={colors.success} />
            <Text style={styles.sectionTitle}>Weight Tracker</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleOpenWeightModal}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {currentWeight && (
            <View style={styles.weightSummary}>
              <View style={styles.weightCurrent}>
                <Text style={styles.weightCurrentValue}>
                  {currentWeight} {weightUnit}
                </Text>
                <Text style={styles.weightCurrentLabel}>Current</Text>
              </View>
              {weightChange && (
                <View style={styles.weightChange}>
                  <View style={styles.weightChangeRow}>
                    <Ionicons
                      name={weightChange.change > 0 ? 'arrow-up' : 'arrow-down'}
                      size={16}
                      color={weightChange.change > 0 ? colors.error : colors.success}
                    />
                    <Text
                      style={[
                        styles.weightChangeValue,
                        { color: weightChange.change > 0 ? colors.error : colors.success },
                      ]}
                    >
                      {Math.abs(weightChange.change).toFixed(1)} {weightUnit}
                    </Text>
                  </View>
                  <Text style={styles.weightChangeLabel}>
                    over {weightChange.days} days
                  </Text>
                </View>
              )}
            </View>
          )}

          <WeightGraph
            entries={allWeightEntries}
            showFullHistory={showFullWeightHistory}
            onToggleHistory={() => setShowFullWeightHistory(!showFullWeightHistory)}
          />
        </Card>

        {/* Muscle Group Distribution */}
        {muscleGroupStats.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="body-outline" size={20} color={colors.primaryLight} />
              <Text style={styles.sectionTitle}>Muscle Groups</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Last 20 workouts</Text>

            <View style={styles.muscleGroupList}>
              {muscleGroupStats.map(([group, count]) => {
                const maxCount = muscleGroupStats[0][1];
                const percentage = (count / maxCount) * 100;

                return (
                  <View key={group} style={styles.muscleGroupItem}>
                    <View style={styles.muscleGroupHeader}>
                      <Text style={styles.muscleGroupName}>{group}</Text>
                      <Text style={styles.muscleGroupCount}>{count}x</Text>
                    </View>
                    <View style={styles.muscleGroupBarBg}>
                      <View
                        style={[
                          styles.muscleGroupBar,
                          { width: `${percentage}%` },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Lifetime Stats */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={20} color={colors.warning} />
            <Text style={styles.sectionTitle}>All Time</Text>
          </View>

          <View style={styles.lifetimeGrid}>
            <View style={styles.lifetimeItem}>
              <Text style={styles.lifetimeValue}>{history.totalWorkoutsCompleted}</Text>
              <Text style={styles.lifetimeLabel}>Total Workouts</Text>
            </View>
            <View style={styles.lifetimeItem}>
              <Text style={styles.lifetimeValue}>{history.totalMinutesWorked}</Text>
              <Text style={styles.lifetimeLabel}>Minutes</Text>
            </View>
            <View style={styles.lifetimeItem}>
              <Text style={styles.lifetimeValue}>{history.totalCaloriesBurned}</Text>
              <Text style={styles.lifetimeLabel}>Calories</Text>
            </View>
            <View style={styles.lifetimeItem}>
              <Text style={styles.lifetimeValue}>{history.streak.longest}</Text>
              <Text style={styles.lifetimeLabel}>Best Streak</Text>
            </View>
          </View>
        </Card>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Weight Entry Modal */}
      <Modal
        visible={showWeightModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseWeightModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleCloseWeightModal}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Log Weight</Text>

              {/* Date Selector */}
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowDatePicker(!showDatePicker)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.dateSelectorText}>{formatDisplayDate(selectedDate)}</Text>
                <Ionicons
                  name={showDatePicker ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {/* Date Picker Dropdown */}
              {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  {getRecentDates().map((date) => {
                    const dateStr = getLocalDateString(date);
                    const isSelected = getLocalDateString(selectedDate) === dateStr;
                    const existingEntry = getEntryForDate(date);
                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={[styles.dateOption, isSelected && styles.dateOptionSelected]}
                        onPress={() => {
                          setSelectedDate(date);
                          setShowDatePicker(false);
                          setShowOverwriteConfirm(false);
                          setExistingWeight(null);
                        }}
                      >
                        <Text style={[styles.dateOptionText, isSelected && styles.dateOptionTextSelected]}>
                          {formatDisplayDate(date)}
                        </Text>
                        {existingEntry && (
                          <Text style={styles.dateOptionWeight}>
                            {existingEntry.weight} {weightUnit}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.weightInputContainer}>
                <TextInput
                  style={styles.weightInput}
                  value={newWeight}
                  onChangeText={(text) => {
                    setNewWeight(text);
                    setShowOverwriteConfirm(false);
                    setExistingWeight(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                <Text style={styles.weightInputUnit}>{weightUnit}</Text>
              </View>

              {showOverwriteConfirm && existingWeight !== null && (
                <View style={styles.overwriteWarning}>
                  <Ionicons name="warning" size={18} color={colors.warning} />
                  <Text style={styles.overwriteWarningText}>
                    You already logged {existingWeight} {weightUnit} for {formatDisplayDate(selectedDate).toLowerCase()}. Save to replace it.
                  </Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={handleCloseWeightModal}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonSave}
                  onPress={handleAddWeight}
                >
                  <Text style={styles.modalButtonSaveText}>
                    {showOverwriteConfirm ? 'Replace' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Monthly Overview
  monthlyStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  monthlyStatItem: {
    alignItems: 'center',
  },
  monthlyStatValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  monthlyStatLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Calendar
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  calendarNav: {
    padding: spacing.xs,
  },
  calendarTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  calendarDayHeader: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
    width: 36,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayContainer: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  calendarDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  calendarDayExercise: {
    backgroundColor: colors.success + '30',
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  calendarDayText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  calendarDayTextToday: {
    color: colors.primary,
    fontWeight: typography.bold,
  },

  // Weekly Stats
  weeklyStats: {
    marginBottom: spacing.md,
  },
  weeklyStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  weeklyStatLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  weeklyStatValue: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },

  // Mini Chart
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barContainer: {
    alignItems: 'center',
  },
  bar: {
    borderRadius: borderRadius.xs,
    marginBottom: spacing.xs,
  },
  barLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },

  // Weight Tracker
  weightSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weightCurrent: {
    alignItems: 'flex-start',
  },
  weightCurrentValue: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.text,
  },
  weightCurrentLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  weightChange: {
    alignItems: 'flex-end',
  },
  weightChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weightChangeValue: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
  },
  weightChangeLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },

  // Graph
  graphWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxisLabels: {
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
  },
  axisLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  graphArea: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  graphLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.success,
    transformOrigin: 'left center',
  },
  graphPoint: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  xAxisLabels: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  xAxisLabelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  xAxisLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyToggleText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  emptyGraph: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGraphText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  emptyGraphSubtext: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Muscle Groups
  muscleGroupList: {
    gap: spacing.sm,
  },
  muscleGroupItem: {
    gap: spacing.xs,
  },
  muscleGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muscleGroupName: {
    fontSize: typography.sm,
    color: colors.text,
    textTransform: 'capitalize',
  },
  muscleGroupCount: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  muscleGroupBarBg: {
    height: 6,
    backgroundColor: colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  muscleGroupBar: {
    height: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: 3,
  },

  // Lifetime Stats
  lifetimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  lifetimeItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  lifetimeValue: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.primary,
  },
  lifetimeLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Modal
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  dateSelectorText: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  datePickerContainer: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateOptionSelected: {
    backgroundColor: colors.primary + '20',
  },
  dateOptionText: {
    fontSize: typography.sm,
    color: colors.text,
  },
  dateOptionTextSelected: {
    color: colors.primary,
    fontWeight: typography.semibold,
  },
  dateOptionWeight: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  weightInput: {
    fontSize: typography['3xl'],
    fontWeight: typography.bold,
    color: colors.text,
    textAlign: 'right',
    minWidth: 80,
    padding: 0,
  },
  weightInputUnit: {
    fontSize: typography.xl,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  overwriteWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  overwriteWarningText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.warning,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButtonCancel: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  modalButtonSave: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalButtonSaveText: {
    fontSize: typography.base,
    color: colors.text,
    fontWeight: typography.semibold,
  },
});
