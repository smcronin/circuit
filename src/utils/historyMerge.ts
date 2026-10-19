import type { WorkoutHistory, WorkoutSession } from '../types/workout';
import type { SummarizedWorkoutHistory } from '../types/llm';

export interface HistoryData {
  history: WorkoutHistory;
  workoutSummary?: SummarizedWorkoutHistory;
  deletedSessions?: Record<string, string>;
}

const time = (value?: string) => value ? Date.parse(value) || 0 : 0;
const sessionTime = (s: WorkoutSession) => time(s.completedAt || s.stoppedAt || s.startedAt || s.workout.createdAt);

// Stable comparison is also used to fingerprint immutable server revisions.
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function mergeSession(a: WorkoutSession, b: WorkoutSession): WorkoutSession {
  // Backgrounding and completion share an ID. Keep the completed attempt.
  const rank = (s: WorkoutSession) => s.status === 'completed' ? 2 : s.status === 'stopped_early' ? 1 : 0;
  const winner = rank(a) !== rank(b) ? (rank(a) > rank(b) ? a : b)
    : sessionTime(a) > sessionTime(b) ? a : b;
  const other = winner === a ? b : a;
  const feedback = time(a.feedback?.updatedAt) > time(b.feedback?.updatedAt) ? a.feedback : b.feedback;
  const result = { ...other, ...winner };
  if (a.feedback || b.feedback) result.feedback = feedback || a.feedback || b.feedback;
  // Cloud snapshots deliberately omit GPS points; never erase the on-device trace.
  if (result.ride) {
    const points = (a.ride?.points.length || 0) > (b.ride?.points.length || 0) ? a.ride?.points : b.ride?.points;
    if (points?.length) result.ride = { ...result.ride, points };
  }
  return result;
}

export function historyFromSessions(sessions: WorkoutSession[]): WorkoutHistory {
  const completed = sessions.filter(s => s.status === 'completed');
  const days = [...new Set(completed.map(s => {
    const d = new Date(s.completedAt || s.startedAt || s.workout.createdAt);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }))].filter(Number.isFinite).sort((a, b) => b - a);
  let run = 0, longest = 0, current = 0;
  for (let i = 0; i < days.length; i++) {
    run = i && days[i - 1] - days[i] === 86400000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    if (i === run - 1) current = run;
  }
  const now = new Date();
  if (!days.length || Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - days[0] > 86400000) current = 0;
  return {
    sessions,
    totalWorkoutsCompleted: completed.length,
    totalMinutesWorked: sessions.reduce((sum, s) => sum + Math.round(s.actualDurationWorked / 60), 0),
    totalCaloriesBurned: sessions.reduce((sum, s) => sum + s.estimatedCaloriesBurned, 0),
    streak: { current, longest, ...(completed[0] ? { lastWorkoutDate: completed[0].completedAt } : {}) },
  };
}

export function mergeHistory(a: HistoryData, b: HistoryData): HistoryData {
  const deletedSessions = { ...a.deletedSessions };
  for (const [id, at] of Object.entries(b.deletedSessions || {})) {
    if (time(at) >= time(deletedSessions[id])) deletedSessions[id] = at;
  }
  const sessions = new Map<string, WorkoutSession>();
  for (const session of [...a.history.sessions, ...b.history.sessions]) {
    if (deletedSessions[session.id]) continue;
    const previous = sessions.get(session.id);
    sessions.set(session.id, previous ? mergeSession(previous, session) : session);
  }
  const ordered = [...sessions.values()].sort((x, y) => sessionTime(y) - sessionTime(x) || x.id.localeCompare(y.id));
  const workoutSummary = time(a.workoutSummary?.generatedAt) > time(b.workoutSummary?.generatedAt)
    ? a.workoutSummary : b.workoutSummary || a.workoutSummary;
  return { history: historyFromSessions(ordered), workoutSummary, deletedSessions };
}
