import { WorkoutSummary, SummarizedWorkoutHistory } from '@/types/llm';

export interface GenerationContext {
  userGoals: string;
  equipmentAvailable: string[];
  equipmentNotes?: string;
  trainingNotes?: string;
  requestedDuration: number;
  recentWorkouts: WorkoutSummary[];
  olderWorkoutsSummary?: SummarizedWorkoutHistory;
  userAge?: number;
  userWeight?: number;
  feedback?: string;
  customInstructions?: string;
}

export function getSystemPrompt(): string {
  return `You are an expert fitness coach and workout designer. Your task is to create structured, effective workouts based on user preferences and constraints.

IMPORTANT: You must respond with valid JSON that matches the exact schema provided. Do not include any text outside the JSON.

Guidelines for workout design:
1. Always include a warm-up (3-5 minutes) with dynamic movements
2. Design circuits that match the user's available time and equipment
3. Include appropriate rest periods (15-30s between exercises, 60-90s between rounds)
4. Cool-down should include stretches for worked muscle groups (2-4 minutes)
5. Exercise durations should be realistic (30-60 seconds per exercise)
6. Rep targets should be achievable in the given time
7. Provide progressive overload by varying from recent workouts
8. Consider user's fitness goals when selecting exercises
9. Use ONLY the equipment specified - if no equipment, use bodyweight only
10. Write personalized workout descriptions that reference the user's goals and explain how this workout helps achieve them

Calorie estimates should be reasonable:
- Light workout (mostly stretching/mobility): 3-5 cal/min
- Moderate workout (steady pace): 6-8 cal/min
- High intensity (HIIT, circuits): 10-15 cal/min

Exercise difficulty progression:
- Beginner: Focus on form, longer rests, simpler movements
- Intermediate: Moderate intensity, compound movements
- Advanced: High intensity, complex movements, shorter rests

Side-switching exercises:
- For exercises where the user needs to switch sides, create TWO independent exercises (with minimal rest in between)
- Example: "Pistol Squat - Right Leg" with rest 5-10 seconds, then "Pistol Squat - Left Leg"
- This ensures both sides are represented evenly in the circuit and allows proper tracking of each side
- Apply this pattern to: lunges, single-leg deadlifts, pistol squats, single-arm rows, Bulgarian split squats, single-arm presses, etc.`;
}

export function buildPrompt(context: GenerationContext): string {
  const {
    userGoals,
    equipmentAvailable,
    equipmentNotes,
    trainingNotes,
    requestedDuration,
    recentWorkouts,
    olderWorkoutsSummary,
    userAge,
    userWeight,
    feedback,
    customInstructions,
  } = context;

  let prompt = `Create a ${requestedDuration}-minute workout with the following constraints:

USER PROFILE:
- Fitness Goals: ${userGoals}
${userAge ? `- Age: ${userAge}` : ''}
${userWeight ? `- Weight: ${userWeight}` : ''}
${trainingNotes ? `\nTRAINING CONTEXT & ABILITIES:\n${trainingNotes}` : ''}

AVAILABLE EQUIPMENT:
${equipmentAvailable.length > 0 ? equipmentAvailable.map((e) => `- ${e}`).join('\n') : '- Bodyweight only (no equipment)'}
${equipmentNotes ? `\nEQUIPMENT NOTES:\n${equipmentNotes}` : ''}
`;

  if (recentWorkouts.length > 0) {
    // Check for high RPE or fatigue indicators
    const hasHighRpe = recentWorkouts.some((w) => w.rpe && w.rpe >= 8);
    const hasFatigueNotes = recentWorkouts.some(
      (w) =>
        w.notes &&
        (w.notes.toLowerCase().includes('sore') ||
          w.notes.toLowerCase().includes('tired') ||
          w.notes.toLowerCase().includes('fatigue') ||
          w.notes.toLowerCase().includes('exhausted'))
    );

    prompt += `
RECENT WORKOUTS (for variety and progressive overload):
${recentWorkouts
  .map(
    (w, i) => `${i + 1}. "${w.name}" - Focus: ${w.focusAreas.join(', ')} - Date: ${w.completedAt}
   Exercises used: ${w.exercisesUsed.slice(0, 5).join(', ')}${w.rpe ? `\n   User RPE: ${w.rpe}/10` : ''}${w.notes ? `\n   User notes: "${w.notes}"` : ''}`
  )
  .join('\n')}

Ensure this workout provides variety from recent sessions. Avoid repeating the same exercises if possible.
${hasHighRpe ? '\nNOTE: User has reported high exertion (RPE 8+) recently. Consider recovery-focused or lighter intensity options.' : ''}
${hasFatigueNotes ? '\nNOTE: User has mentioned fatigue or soreness. Adjust intensity appropriately and consider mobility/recovery work.' : ''}
`;
  }

  if (olderWorkoutsSummary) {
    prompt += `
WORKOUT HISTORY SUMMARY (${olderWorkoutsSummary.totalWorkouts} workouts from ${olderWorkoutsSummary.dateRange}):
${olderWorkoutsSummary.summary}
${olderWorkoutsSummary.averageRPE ? `- Average RPE: ${olderWorkoutsSummary.averageRPE.toFixed(1)}/10` : ''}
- Common focus areas: ${olderWorkoutsSummary.commonFocusAreas.join(', ')}
- Frequently used exercises: ${olderWorkoutsSummary.frequentExercises.slice(0, 8).join(', ')}

Use this context to personalize the workout and build on the user's training history.
`;
  }

  if (feedback) {
    prompt += `
USER FEEDBACK FOR MODIFICATION:
"${feedback}"

Please adjust the workout based on this feedback. Generate a new workout that addresses the user's concerns.
`;
  }

  if (customInstructions) {
    prompt += `
## IMPORTANT INSTRUCTIONS
The user has provided the following request for this specific workout:
"${customInstructions}"

You MUST follow these custom instructions when designing this workout.
`;
  }

  prompt += `
Return a JSON object with this exact structure:
{
  "name": "string - creative workout name (e.g., 'Full Body Blitz', 'Core Crusher')",
  "description": "string - personalized description (2-3 sentences) that explains what muscle groups/areas the workout targets, how it connects to the user's specific fitness goals, and what benefits they'll gain from this session",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimatedCalories": number,
  "calorieRange": { "low": number, "high": number },
  "focusAreas": ["strength", "cardio", "flexibility", "core", "upper body", "lower body", etc.],
  "muscleGroupsTargeted": ["chest", "back", "shoulders", "biceps", "triceps", "core", "quads", "hamstrings", "glutes", "calves"],
  "equipmentRequired": ["dumbbell", etc. or empty array for bodyweight],

  "warmUp": {
    "exercises": [
      {
        "name": "string",
        "duration": number (seconds, typically 30-45),
        "description": "string - clear instructions on how to perform",
        "muscleGroups": ["string"]
      }
    ]
  },

  "circuits": [
    {
      "name": "string (e.g., 'Power Circuit', 'Burn Zone')",
      "rounds": number (typically 2-4),
      "restBetweenRounds": number (seconds, typically 45-90),
      "restBetweenExercises": number (seconds, typically 10-20),
      "exercises": [
        {
          "name": "string",
          "duration": number (seconds, typically 30-45),
          "targetReps": number (optional, e.g., 12),
          "repRange": "string like '8-12'" (optional),
          "description": "string - clear form cues and instructions",
          "muscleGroups": ["string"],
          "equipment": ["string"] (optional, only if equipment needed),
          "modifications": {
            "easier": "string - easier variation" (optional),
            "harder": "string - harder variation" (optional)
          }
        }
      ]
    }
  ],

  "coolDown": {
    "exercises": [
      {
        "name": "string",
        "duration": number (seconds, typically 30-45),
        "description": "string - stretching/breathing cues",
        "muscleGroups": ["string"]
      }
    ]
  }
}

IMPORTANT TIMING RULES:
- Total workout time should be close to ${requestedDuration} minutes
- Warm-up: 3-5 minutes
- Main circuits: ${Math.max(requestedDuration - 8, 10)} minutes
- Cool-down: 2-4 minutes
- Account for all rest periods in your time calculation`;

  return prompt;
}
