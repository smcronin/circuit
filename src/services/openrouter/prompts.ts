export interface GenerationContext {
  userGoals: string;
  equipmentAvailable: string[];
  equipmentNotes?: string;
  trainingNotes?: string;
  requestedDuration: number;
  recentWorkouts: WorkoutSummary[];
  userAge?: number;
  userWeight?: number;
  feedback?: string;
}

export interface WorkoutSummary {
  name: string;
  focusAreas: string[];
  exercisesUsed: string[];
  completedAt: string;
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

Calorie estimates should be reasonable:
- Light workout (mostly stretching/mobility): 3-5 cal/min
- Moderate workout (steady pace): 6-8 cal/min
- High intensity (HIIT, circuits): 10-15 cal/min

Exercise difficulty progression:
- Beginner: Focus on form, longer rests, simpler movements
- Intermediate: Moderate intensity, compound movements
- Advanced: High intensity, complex movements, shorter rests`;
}

export function buildPrompt(context: GenerationContext): string {
  const {
    userGoals,
    equipmentAvailable,
    equipmentNotes,
    trainingNotes,
    requestedDuration,
    recentWorkouts,
    userAge,
    userWeight,
    feedback,
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
    prompt += `
RECENT WORKOUTS (for variety and progressive overload):
${recentWorkouts
  .map(
    (w, i) => `${i + 1}. "${w.name}" - Focus: ${w.focusAreas.join(', ')} - Date: ${w.completedAt}
   Exercises used: ${w.exercisesUsed.slice(0, 5).join(', ')}`
  )
  .join('\n')}

Ensure this workout provides variety from recent sessions. Avoid repeating the same exercises if possible.
`;
  }

  if (feedback) {
    prompt += `
USER FEEDBACK FOR MODIFICATION:
"${feedback}"

Please adjust the workout based on this feedback. Generate a new workout that addresses the user's concerns.
`;
  }

  prompt += `
Return a JSON object with this exact structure:
{
  "name": "string - creative workout name (e.g., 'Full Body Blitz', 'Core Crusher')",
  "description": "string - brief motivating description (1-2 sentences)",
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
