import { WorkoutSession } from '@/types/workout';
import { SummarizedWorkoutHistory } from '@/types/llm';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const SUMMARY_MODEL = 'google/gemini-2.0-flash-001';

export async function summarizeWorkoutHistory(
  sessions: WorkoutSession[]
): Promise<SummarizedWorkoutHistory> {
  if (sessions.length === 0) {
    throw new Error('No sessions to summarize');
  }

  // Calculate date range
  const dates = sessions
    .map((s) => new Date(s.completedAt || s.startedAt || s.workout.createdAt))
    .filter((d) => !isNaN(d.getTime()));

  if (dates.length === 0) {
    throw new Error('No valid dates in sessions');
  }

  const oldestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const newestDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateRange = `${formatDate(oldestDate)} - ${formatDate(newestDate)}`;

  // Aggregate data for the prompt
  const focusAreaCounts: Record<string, number> = {};
  const exerciseCounts: Record<string, number> = {};
  let totalRpe = 0;
  let rpeCount = 0;
  const notesList: string[] = [];

  sessions.forEach((s) => {
    // Count focus areas
    s.workout.focusAreas.forEach((area) => {
      focusAreaCounts[area] = (focusAreaCounts[area] || 0) + 1;
    });

    // Count exercises
    s.workout.circuits.forEach((c) => {
      c.exercises.forEach((e) => {
        exerciseCounts[e.name] = (exerciseCounts[e.name] || 0) + 1;
      });
    });

    // Aggregate RPE
    if (s.feedback?.rpe) {
      totalRpe += s.feedback.rpe;
      rpeCount++;
    }

    // Collect notes
    if (s.feedback?.notes) {
      notesList.push(s.feedback.notes);
    }
  });

  // Sort by frequency
  const commonFocusAreas = Object.entries(focusAreaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area]) => area);

  const frequentExercises = Object.entries(exerciseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([exercise]) => exercise);

  const averageRPE = rpeCount > 0 ? totalRpe / rpeCount : undefined;

  // Build prompt for LLM
  const prompt = `Summarize this workout history in 2-3 concise sentences. Focus on training patterns, user preferences, progress indicators, and any concerns mentioned in notes. This summary will be used to personalize future workout recommendations.

WORKOUT DATA:
- Total workouts: ${sessions.length}
- Date range: ${dateRange}
- Focus areas (by frequency): ${commonFocusAreas.join(', ') || 'varied'}
- Common exercises: ${frequentExercises.slice(0, 8).join(', ') || 'varied'}
${averageRPE ? `- Average perceived exertion (RPE): ${averageRPE.toFixed(1)}/10` : ''}
${notesList.length > 0 ? `- User notes excerpts: "${notesList.slice(0, 5).join('"; "')}"` : '- No user notes recorded'}

Write a concise, actionable summary that captures the user's training tendencies and any feedback they've provided.`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://circuit.app',
      'X-Title': 'Circuit Workout Summarizer',
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to generate workout summary: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  const summary = data.choices[0]?.message?.content?.trim() || '';

  if (!summary) {
    throw new Error('Empty summary returned from LLM');
  }

  return {
    totalWorkouts: sessions.length,
    dateRange,
    summary,
    averageRPE,
    commonFocusAreas,
    frequentExercises,
    generatedAt: new Date().toISOString(),
  };
}
